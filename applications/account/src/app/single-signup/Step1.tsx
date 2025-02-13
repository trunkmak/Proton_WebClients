import { Dispatch, Fragment, ReactElement, ReactNode, SetStateAction, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { c, msgid } from 'ttag';

import { Button } from '@proton/atoms/Button';
import { CircleLoader } from '@proton/atoms/CircleLoader';
import { Href } from '@proton/atoms/Href';
import { InlineLinkButton } from '@proton/atoms/InlineLinkButton';
import { Vr } from '@proton/atoms/Vr';
import { Icon, IconSize, Price, Toggle, VpnLogo, useModalState } from '@proton/components/components';
import { getSimplePriceString } from '@proton/components/components/price/helper';
import {
    CurrencySelector,
    PayPalButton,
    StyledPayPalButton,
    getBlackFridayRenewalNoticeText,
    getCheckoutRenewNoticeText,
    getRenewalNoticeText,
} from '@proton/components/containers';
import {
    isBlackFridayPeriod as getIsBlackFridayPeriod,
    isCyberWeekPeriod as getIsCyberWeekPeriod,
} from '@proton/components/containers/offers/helpers/offerPeriods';
import Alert3ds from '@proton/components/containers/payments/Alert3ds';
import InclusiveVatText from '@proton/components/containers/payments/InclusiveVatText';
import PaymentWrapper from '@proton/components/containers/payments/PaymentWrapper';
import { WrappedTaxCountrySelector } from '@proton/components/containers/payments/TaxCountrySelector';
import { getCalendarAppFeature } from '@proton/components/containers/payments/features/calendar';
import { getDriveAppFeature } from '@proton/components/containers/payments/features/drive';
import { getMailAppFeature } from '@proton/components/containers/payments/features/mail';
import {
    get2FAAuthenticator,
    getHideMyEmailAliases,
    getLoginsAndNotes,
    getPassAppFeature,
    getVaultSharing,
} from '@proton/components/containers/payments/features/pass';
import {
    getAdvancedVPNCustomizations,
    getAllPlatforms,
    getBandwidth,
    getCountries,
    getNetShield,
    getNoAds,
    getPrioritySupport,
    getProtectDevices,
    getRefundable,
    getStreaming,
    getVPNAppFeature,
    getVPNSpeed,
} from '@proton/components/containers/payments/features/vpn';
import { getTotalBillingText } from '@proton/components/containers/payments/helper';
import VPNPassPromotionButton from '@proton/components/containers/payments/subscription/VPNPassPromotionButton';
import { useActiveBreakpoint, useApi } from '@proton/components/hooks';
import { ChargebeePaypalWrapper } from '@proton/components/payments/chargebee/ChargebeeWrapper';
import { usePaymentFacade } from '@proton/components/payments/client-extensions';
import { useChargebeeContext } from '@proton/components/payments/client-extensions/useChargebeeContext';
import {
    BillingAddress,
    PAYMENT_METHOD_TYPES,
    TokenPayment,
    TokenPaymentWithPaymentsVersion,
    isV5PaymentToken,
    v5PaymentTokenToLegacyPaymentToken,
} from '@proton/components/payments/core';
import { PaymentProcessorHook } from '@proton/components/payments/react-extensions/interface';
import { usePaymentsApi } from '@proton/components/payments/react-extensions/usePaymentsApi';
import { useLoading } from '@proton/hooks';
import metrics, { observeApiError } from '@proton/metrics';
import { WebCoreVpnSingleSignupStep1InteractionTotal } from '@proton/metrics/types/web_core_vpn_single_signup_step1_interaction_total_v1.schema';
import { getSilentApi } from '@proton/shared/lib/api/helpers/customConfig';
import { getPaymentsVersion } from '@proton/shared/lib/api/payments';
import { TelemetryAccountSignupEvents } from '@proton/shared/lib/api/telemetry';
import {
    ADDON_NAMES,
    APPS,
    BRAND_NAME,
    CYCLE,
    DEFAULT_CYCLE,
    PASS_APP_NAME,
    PLANS,
    VPN_APP_NAME,
    VPN_CONNECTIONS,
    VPN_SHORT_APP_NAME,
} from '@proton/shared/lib/constants';
import { canUpsellToVPNPassBundle } from '@proton/shared/lib/helpers/blackfriday';
import { SubscriptionCheckoutData, getCheckout, getOptimisticCheckResult } from '@proton/shared/lib/helpers/checkout';
import isDeepEqual from '@proton/shared/lib/helpers/isDeepEqual';
import { getPlanFromPlanIDs } from '@proton/shared/lib/helpers/planIDs';
import { captureMessage } from '@proton/shared/lib/helpers/sentry';
import {
    getHas2023OfferCoupon,
    getIsVpnPlan,
    getPricingFromPlanIDs,
    getTotalFromPricing,
} from '@proton/shared/lib/helpers/subscription';
import { stringifySearchParams } from '@proton/shared/lib/helpers/url';
import { Currency, Cycle, CycleMapping, Plan, VPNServersCountData } from '@proton/shared/lib/interfaces';
import { getSentryError } from '@proton/shared/lib/keys';
import { generatePassword } from '@proton/shared/lib/password';
import { FREE_PLAN } from '@proton/shared/lib/subscription/freePlans';
import { getFreeServers, getPlusServers, getVpnServers } from '@proton/shared/lib/vpn/features';
import { CSS_BASE_UNIT_SIZE } from '@proton/styles';
import clsx from '@proton/utils/clsx';
import isTruthy from '@proton/utils/isTruthy';
import noop from '@proton/utils/noop';

import { getLocaleTermsURL } from '../content/helper';
import SignupSupportDropdown from '../signup/SignupSupportDropdown';
import { getSubscriptionPrices } from '../signup/helper';
import { PlanIDs, SignupCacheResult, SignupType, SubscriptionData } from '../signup/interfaces';
import AccountStepDetails, { AccountStepDetailsRef } from '../single-signup-v2/AccountStepDetails';
import FreeLogo from '../single-signup-v2/FreeLogo';
import bundleVpnPass from '../single-signup-v2/bundle-vpn-pass.svg';
import bundle from '../single-signup-v2/bundle.svg';
import { getFreeSubscriptionData, getFreeTitle, getSubscriptionMapping } from '../single-signup-v2/helper';
import { OptimisticOptions, SignupModelV2 } from '../single-signup-v2/interface';
import { getPaymentMethod } from '../single-signup-v2/measure';
import { useFlowRef } from '../useFlowRef';
import AddonSummary from './AddonSummary';
import Box from './Box';
import CycleSelector from './CycleSelector';
import GiftCodeSummary from './GiftCodeSummary';
import Guarantee from './Guarantee';
import Layout, { Background } from './Layout';
import RightPlanSummary from './RightPlanSummary';
import SaveLabel2 from './SaveLabel2';
import StepLabel from './StepLabel';
import UpsellModal from './UpsellModal';
import VPNPassUpsellToggle from './VPNPassUpsellButton';
import VpnProLogo from './VpnProLogo';
import swissFlag from './flag.svg';
import { getBillingCycleText, getOffText, getUpsellShortPlan } from './helper';
import { Measure } from './interface';
import { TelemetryPayType } from './measure';
import PlanCustomizer from './planCustomizer/PlanCustomizer';
import getAddonsPricing from './planCustomizer/getAddonsPricing';

const getPlanInformation = (
    selectedPlan: Plan,
    vpnServersCountData: VPNServersCountData,
    flow: 'pricing' | 'signup'
) => {
    const iconSize: IconSize = 7;
    const iconImgSize = iconSize * CSS_BASE_UNIT_SIZE;

    if (selectedPlan.Name === PLANS.FREE) {
        const freeServers = getFreeServers(vpnServersCountData.free.servers, vpnServersCountData.free.countries);
        return {
            logo: <FreeLogo size={iconImgSize} app={APPS.PROTONVPN_SETTINGS} />,
            title: getFreeTitle(BRAND_NAME),
            features: [getCountries(freeServers), getNoAds(), getBandwidth()],
        };
    }

    if (selectedPlan.Name === PLANS.VPN || selectedPlan.Name === PLANS.VPN2024) {
        const plusServers = getPlusServers(vpnServersCountData.paid.servers, vpnServersCountData.paid.countries);
        return {
            logo: <VpnLogo variant="glyph-only" size={iconSize} />,
            title: selectedPlan.Title,
            features: [
                flow === 'pricing' ? getCountries(plusServers) : undefined,
                getVPNSpeed('highest'),
                flow === 'pricing' ? getStreaming(true) : undefined,
                getProtectDevices(VPN_CONNECTIONS),
                getAllPlatforms(),
                getNetShield(true),
                flow === 'signup' ? getStreaming(true) : undefined,
                getPrioritySupport(),
                getAdvancedVPNCustomizations(true),
                flow === 'pricing' ? getRefundable() : undefined,
            ].filter(isTruthy),
        };
    }

    if (selectedPlan.Name === PLANS.BUNDLE) {
        return {
            logo: (
                <div>
                    <img src={bundle} width={iconImgSize} height={iconImgSize} alt={selectedPlan.Title} />
                </div>
            ),
            title: selectedPlan.Title,
            features: [
                getMailAppFeature(),
                getCalendarAppFeature(),
                getDriveAppFeature(),
                getVPNAppFeature({ serversCount: vpnServersCountData }),
                getPassAppFeature(),
            ],
        };
    }

    if (selectedPlan.Name === PLANS.VPN_PASS_BUNDLE) {
        return {
            logo: (
                <div>
                    <img src={bundleVpnPass} width={iconImgSize} height={iconImgSize} alt={selectedPlan.Title} />
                </div>
            ),
            title: selectedPlan.Title,
            features: [],
            bundle: [
                {
                    title: `${VPN_APP_NAME} Plus`,
                    features: [
                        getVPNSpeed('highest'),
                        getProtectDevices(VPN_CONNECTIONS),
                        getNetShield(true),
                        getAdvancedVPNCustomizations(true),
                    ],
                },
                {
                    title: `${PASS_APP_NAME} Plus`,
                    features: [
                        getLoginsAndNotes(),
                        getHideMyEmailAliases('unlimited'),
                        get2FAAuthenticator(true),
                        getVaultSharing(10),
                    ],
                },
            ],
        };
    }

    const serversInNCountries = c('new_plans: feature').ngettext(
        msgid`Servers in ${vpnServersCountData.paid.countries}+ country`,
        `Servers in ${vpnServersCountData.paid.countries}+ countries`,
        vpnServersCountData.paid.countries
    );

    if (selectedPlan.Name === PLANS.VPN_PRO) {
        return {
            logo: <VpnProLogo size={iconSize} />,
            title: selectedPlan.Title,
            features: [
                {
                    text: c('new_plans: feature').t`Advanced network security`,
                    included: true,
                },
                {
                    text: serversInNCountries,
                    included: true,
                },
                {
                    text: c('new_plans: feature').t`24/7 support`,
                    included: true,
                },
                {
                    text: c('new_plans: feature').t`Centralized settings and billings`,
                    included: true,
                },
            ],
        };
    }

    if (selectedPlan.Name === PLANS.VPN_BUSINESS) {
        return {
            logo: <VpnLogo variant="glyph-only" size={iconSize} />,
            title: selectedPlan.Title,
            features: [
                {
                    text: c('new_plans: feature').t`Advanced network security`,
                    included: true,
                },
                {
                    text: serversInNCountries,
                    included: true,
                },
                {
                    text: c('new_plans: feature').t`Dedicated servers and IP`,
                    included: true,
                },
                {
                    text: c('new_plans: feature').t`24/7 support`,
                    included: true,
                },
                {
                    text: c('new_plans: feature').t`Centralized settings and billings`,
                    included: true,
                },
            ],
        };
    }
};

const getYears = (n: number) => c('vpn_2step: info').ngettext(msgid`${n} year`, `${n} years`, n);
const getMonths = (n: number) => c('vpn_2step: info').ngettext(msgid`${n} month`, `${n} months`, n);
export const getBilledText = (cycle: CYCLE): string | null => {
    switch (cycle) {
        case CYCLE.MONTHLY:
            return c('vpn_2step: billing').t`Billed monthly`;
        case CYCLE.YEARLY:
            return getYears(1);
        case CYCLE.TWO_YEARS:
            return getYears(2);
        case CYCLE.FIFTEEN:
            return getMonths(15);
        case CYCLE.THIRTY:
            return getMonths(30);
        default:
            return null;
    }
};

const getPlanTitle = (selected: string) => {
    return c('vpn_2step: info').t`Your ${selected} plan`;
};
const FeatureItem = ({ left, text }: { left: ReactNode; text: string }) => {
    return (
        <div className="flex items-center text-center flex-column md:flex-row justify-center">
            <div className="md:mr-4 text-center">{left}</div>
            <div>{text}</div>
        </div>
    );
};

const BoxHeader = ({ step, title, right }: { step?: number; title: string; right?: ReactNode }) => {
    return (
        <div className="flex items-center justify-space-between flex-nowrap">
            <div className="flex md:items-center flex-column md:flex-row md:gap-4 gap-2">
                {step !== undefined && (
                    <div className="shrink-0">
                        <StepLabel step={step} />
                    </div>
                )}
                <h2 className="text-bold text-4xl md:flex-1">{title}</h2>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    );
};

const BoxContent = ({ children }: { children: ReactNode }) => {
    return <div className="pricing-box-content mt-8">{children}</div>;
};

type StepId = WebCoreVpnSingleSignupStep1InteractionTotal['Labels']['step'];
type HasBeenCountedState = {
    [key in StepId]: boolean;
};

const Step1 = ({
    defaultEmail,
    mode,
    selectedPlan,
    hasExtendedCycles,
    isVpn2024Deal,
    isB2bPlan,
    background,
    onComplete,
    model,
    setModel,
    upsellShortPlan,
    vpnServersCountData,
    hideFreePlan,
    upsellImg,
    measure,
    onChallengeError,
    onChallengeLoaded,
    className,
    loading,
}: {
    defaultEmail?: string;
    mode: 'signup' | 'pricing';
    selectedPlan: Plan;
    hasExtendedCycles: boolean;
    isVpn2024Deal: boolean;
    isB2bPlan: boolean;
    background?: Background;
    upsellShortPlan: ReturnType<typeof getUpsellShortPlan> | undefined;
    vpnServersCountData: VPNServersCountData;
    onComplete: (data: {
        accountData: SignupCacheResult['accountData'];
        subscriptionData: SignupCacheResult['subscriptionData'];
        type: 'signup';
    }) => void;
    model: SignupModelV2;
    setModel: Dispatch<SetStateAction<SignupModelV2>>;
    hideFreePlan: boolean;
    upsellImg: ReactElement;
    measure: Measure;
    onChallengeError: () => void;
    onChallengeLoaded: () => void;
    className?: string;
    loading: boolean;
}) => {
    const [upsellModalProps, setUpsellModal, renderUpsellModal] = useModalState();
    const { viewportWidth } = useActiveBreakpoint();
    const [loadingChallenge, setLoadingChallenge] = useState(false);
    const normalApi = useApi();
    const silentApi = getSilentApi(normalApi);
    const { getPaymentsApi } = usePaymentsApi();
    const [toggleUpsell, setToggleUpsell] = useState<{ from: CYCLE; to: CYCLE } | undefined>(undefined);
    const accountDetailsRef = useRef<AccountStepDetailsRef>();
    const [couponCode, setCouponCode] = useState(model.subscriptionData.checkResult.Coupon?.Code);

    const createFlow = useFlowRef();

    const [loadingSignup, withLoadingSignup] = useLoading();
    const [loadingPaymentDetails, withLoadingPaymentDetails] = useLoading();

    const { plansMap } = model;

    useEffect(() => {
        if (loading) {
            return;
        }

        metrics.core_vpn_single_signup_pageLoad_2_total.increment({
            step: 'plan_username_payment',
            flow: isB2bPlan ? 'b2b' : 'b2c',
        });
    }, [loading]);

    const hasBeenCountedRef = useRef<HasBeenCountedState>({
        plan: false,
        email: false,
        payment: false,
    });

    const options: OptimisticOptions = {
        currency: model.optimistic.currency || model.subscriptionData.currency,
        cycle: model.optimistic.cycle || model.subscriptionData.cycle,
        plan: model.optimistic.plan || selectedPlan,
        planIDs: model.optimistic.planIDs || model.subscriptionData.planIDs,
        checkResult: model.optimistic.checkResult || model.subscriptionData.checkResult,
        billingAddress: model.optimistic.billingAddress || model.subscriptionData.billingAddress,
    };

    const handleUpdate = (step: StepId) => {
        if (!hasBeenCountedRef.current[step]) {
            metrics.core_vpn_single_signup_step1_interaction_2_total.increment({
                step,
                flow: isB2bPlan ? 'b2b' : 'b2c',
            });

            hasBeenCountedRef.current = {
                ...hasBeenCountedRef.current,
                [step]: true,
            };
        }
    };

    const setOptimisticDiff = (diff: Partial<OptimisticOptions>) => {
        setModel((old) => ({
            ...old,
            optimistic: {
                ...old.optimistic,
                ...diff,
            },
        }));
    };

    const handleOptimistic = async (optimistic: Partial<OptimisticOptions>) => {
        const newCurrency = optimistic.currency || options.currency;
        const newPlanIDs = optimistic.planIDs || options.planIDs;
        const newCycle = optimistic.cycle || options.cycle;
        const newPlan = getPlanFromPlanIDs(model.plansMap, newPlanIDs) || FREE_PLAN;
        const newBillingAddress = optimistic.billingAddress || options.billingAddress;

        // Try a pre-saved check first. If it's not available, then use the default optimistic one.
        // With the regular cycles, it should be available.
        let subscriptionMapping = model.subscriptionDataCycleMapping?.[newPlan.Name as PLANS]?.[newCycle];
        if (!isDeepEqual(newPlanIDs, subscriptionMapping?.planIDs)) {
            subscriptionMapping = undefined;
        }

        const optimisticCheckResult =
            subscriptionMapping?.checkResult ??
            getOptimisticCheckResult({
                plansMap: model.plansMap,
                planIDs: newPlanIDs,
                cycle: newCycle,
            });

        const newOptimistic = {
            ...optimistic,
            plan: newPlan,
            checkResult: optimisticCheckResult,
        };

        try {
            const validateFlow = createFlow();

            setOptimisticDiff(newOptimistic);

            const coupon =
                couponCode || options.checkResult.Coupon?.Code || subscriptionMapping?.checkResult.Coupon?.Code;

            const checkResult = await getSubscriptionPrices(
                getPaymentsApi(silentApi),
                newPlanIDs,
                newCurrency,
                newCycle,
                newBillingAddress,
                coupon
            );

            if (!validateFlow()) {
                return;
            }

            setModel((old) => ({
                ...old,
                subscriptionData: {
                    ...model.subscriptionData,
                    currency: newCurrency,
                    cycle: newCycle,
                    planIDs: newPlanIDs,
                    checkResult,
                    billingAddress: newBillingAddress,
                },
                optimistic: {},
            }));
        } catch (e) {
            // Reset any optimistic state on failures
            setModel((old) => ({
                ...old,
                optimistic: {},
            }));
        }
    };

    const handleChangePlanIds = async (planIDs: PlanIDs, planName: PLANS) => {
        handleUpdate('plan');
        void measure({
            event: TelemetryAccountSignupEvents.planSelect,
            dimensions: { plan: planName },
        });
        void handleOptimistic({ planIDs });
    };

    const handleChangeCurrency = async (currency: Currency) => {
        handleUpdate('plan');
        void measure({
            event: TelemetryAccountSignupEvents.currencySelect,
            dimensions: { currency: currency },
        });
        handleOptimistic({ currency })
            .then(() => {
                metrics.core_vpn_single_signup_step1_currencyChange_2_total.increment({
                    status: 'success',
                    flow: isB2bPlan ? 'b2b' : 'b2c',
                });
            })
            .catch((error) => {
                observeApiError(error, (status) =>
                    metrics.core_vpn_single_signup_step1_currencyChange_2_total.increment({
                        status,
                        flow: isB2bPlan ? 'b2b' : 'b2c',
                    })
                );
            });
    };

    const handleChangeCycle = async (cycle: Cycle, mode?: 'upsell') => {
        if (mode === 'upsell') {
            void measure({
                event: TelemetryAccountSignupEvents.interactUpsell,
                dimensions: {
                    upsell_to: `${options.plan.Name}_${cycle}m`,
                    upsell_from: `${options.plan.Name}_${options.cycle}m`,
                },
            });
        } else {
            void measure({ event: TelemetryAccountSignupEvents.cycleSelect, dimensions: { cycle: `${cycle}` } });
        }
        handleOptimistic({ cycle })
            .then((result) => {
                metrics.core_vpn_single_signup_step1_cycleChange_2_total.increment({
                    status: 'success',
                    flow: isB2bPlan ? 'b2b' : 'b2c',
                });
                return result;
            })
            .catch((error) => {
                observeApiError(error, (status) =>
                    metrics.core_vpn_single_signup_step1_cycleChange_2_total.increment({
                        status,
                        flow: isB2bPlan ? 'b2b' : 'b2c',
                    })
                );
            });
    };

    const handleChangeBillingAddress = (billingAddress: BillingAddress) => {
        void handleOptimistic({ billingAddress });
    };

    const handleCompletion = async (subscriptionData: SubscriptionData) => {
        const accountDataWithoutPassword = await accountDetailsRef.current?.data();
        if (!accountDataWithoutPassword) {
            throw new Error('Invalid data');
        }

        const accountData = {
            ...accountDataWithoutPassword,
            password: generatePassword({ useSpecialChars: true, length: 16 }),
        };

        return onComplete({ subscriptionData, accountData, type: 'signup' });
    };

    const onPay = async (payment: TokenPaymentWithPaymentsVersion | undefined, type: 'cc' | 'pp' | undefined) => {
        const subscriptionData: SubscriptionData = {
            ...model.subscriptionData,
            payment,
            type,
        };
        return handleCompletion(subscriptionData);
    };

    const hasGuarantee =
        [PLANS.VPN, PLANS.VPN2024, PLANS.VPN_PASS_BUNDLE].includes(options.plan.Name as any) || isB2bPlan;

    const measurePay = (
        type: TelemetryPayType,
        event: TelemetryAccountSignupEvents.userCheckout | TelemetryAccountSignupEvents.checkoutError
    ) => {
        if (!options.plan) {
            return;
        }
        void measure({
            event,
            dimensions: {
                type: type,
                plan: options.plan.Name as any,
                cycle: `${options.cycle}`,
                currency: options.currency,
            },
        });
    };

    const measurePaySubmit = (type: TelemetryPayType) => {
        return measurePay(type, TelemetryAccountSignupEvents.userCheckout);
    };
    const measurePayError = (type: TelemetryPayType) => {
        return measurePay(type, TelemetryAccountSignupEvents.checkoutError);
    };

    const validatePayment = () => {
        if (loadingSignup || loadingPaymentDetails) {
            return false;
        }
        return true;
    };

    const chargebeeContext = useChargebeeContext();

    const paymentFacade = usePaymentFacade({
        checkResult: options.checkResult,
        amount: options.checkResult.AmountDue,
        currency: options.currency,
        selectedPlanName: getPlanFromPlanIDs(model.plansMap, options.planIDs)?.Name,
        onChargeable: (_, { chargeablePaymentParameters, sourceType, paymentsVersion }) => {
            return withLoadingSignup(async () => {
                const isFreeSignup = chargeablePaymentParameters.Amount <= 0;

                if (isFreeSignup) {
                    await onPay(undefined, undefined);
                    return;
                }

                metrics.core_vpn_single_signup_step1_payment_2_total.increment({
                    status: 'success',
                    flow: isB2bPlan ? 'b2b' : 'b2c',
                });

                let paymentType: 'cc' | 'pp';
                if (sourceType === PAYMENT_METHOD_TYPES.PAYPAL || sourceType === PAYMENT_METHOD_TYPES.PAYPAL_CREDIT) {
                    paymentType = 'pp';
                } else {
                    paymentType = 'cc';
                }

                const legacyTokenPayment: TokenPayment | undefined = isV5PaymentToken(chargeablePaymentParameters)
                    ? v5PaymentTokenToLegacyPaymentToken(chargeablePaymentParameters).Payment
                    : undefined;

                const withVersion: TokenPaymentWithPaymentsVersion = {
                    ...legacyTokenPayment,
                    paymentsVersion,
                };

                await onPay(withVersion, paymentType);
            });
        },
        flow: 'signup-vpn',
        onMethodChanged: (newMethod) => {
            const value = getPaymentMethod(newMethod.type);
            if (value) {
                void measure({
                    event: TelemetryAccountSignupEvents.paymentSelect,
                    dimensions: { type: value },
                });
            }
        },
    });

    const price = (
        <Price key="price" currency={options.currency}>
            {options.checkResult.AmountDue}
        </Price>
    );

    const upsellPlanName = upsellShortPlan?.title || '';

    const termsHref = (() => {
        return getLocaleTermsURL();
    })();
    const termsAndConditions = (
        <Href key="terms" href={termsHref}>
            {
                // translator: Full sentence "By clicking on "Pay", you agree to our terms and conditions."
                c('new_plans: signup').t`terms and conditions`
            }
        </Href>
    );

    const pricing = getPricingFromPlanIDs(options.planIDs, plansMap);

    const totals = getTotalFromPricing(pricing, options.cycle);

    const getCheckoutForCycle = (
        planIDs: PlanIDs,
        subscriptionMapping: CycleMapping<SubscriptionData>,
        cycle: Cycle
    ) => {
        const checkResult = subscriptionMapping?.[cycle]?.checkResult;
        if (!checkResult) {
            return;
        }
        return getCheckout({
            planIDs,
            plansMap,
            checkResult,
        });
    };

    const checkoutMappingPlanIDs = ((): CycleMapping<SubscriptionCheckoutData> | undefined => {
        const planIDs = options.planIDs;
        // Want to show prices for VPN and VPNBIZ
        const subscriptionMapping = getSubscriptionMapping({
            subscriptionDataCycleMapping: model.subscriptionDataCycleMapping,
            planName: options.plan.Name,
            planIDs,
        });
        if (!subscriptionMapping) {
            return;
        }
        return {
            [CYCLE.MONTHLY]: getCheckoutForCycle(planIDs, subscriptionMapping, CYCLE.MONTHLY),
            [CYCLE.YEARLY]: getCheckoutForCycle(planIDs, subscriptionMapping, CYCLE.YEARLY),
            [CYCLE.TWO_YEARS]: getCheckoutForCycle(planIDs, subscriptionMapping, CYCLE.TWO_YEARS),
            [CYCLE.FIFTEEN]: getCheckoutForCycle(planIDs, subscriptionMapping, CYCLE.FIFTEEN),
            [CYCLE.THIRTY]: getCheckoutForCycle(planIDs, subscriptionMapping, CYCLE.THIRTY),
        };
    })();

    const actualCheckout = getCheckout({
        planIDs: options.planIDs,
        plansMap,
        checkResult: options.checkResult,
    });

    const { cycles, upsellCycle } = (() => {
        if (hasExtendedCycles) {
            return {
                upsellCycle: CYCLE.THIRTY,
                cycles: viewportWidth['>=large']
                    ? [CYCLE.MONTHLY, CYCLE.THIRTY, CYCLE.FIFTEEN]
                    : [CYCLE.THIRTY, CYCLE.FIFTEEN, CYCLE.MONTHLY],
            };
        }

        return {
            upsellCycle: CYCLE.TWO_YEARS,
            cycles: viewportWidth['>=large']
                ? [CYCLE.MONTHLY, CYCLE.TWO_YEARS, CYCLE.YEARLY]
                : [CYCLE.TWO_YEARS, CYCLE.YEARLY, CYCLE.MONTHLY],
        };
    })();

    const iconColorClassName = background === 'bf2023' ? 'color-norm' : 'color-primary';
    const features = [
        {
            left: <Icon size={6} className={iconColorClassName} name="code" />,
            text: c('Info').t`Open source`,
        },
        {
            left: <Icon size={6} className={iconColorClassName} name="eye-slash" />,
            text: c('new_plans: feature').t`No-logs policy`,
        },
        {
            left: <img width="24" alt="" src={swissFlag} />,
            text: viewportWidth['>=large'] ? c('Info').t`Protected by Swiss privacy laws` : c('Info').t`Swiss based`,
        },
        viewportWidth['>=large'] &&
            [PLANS.VPN, PLANS.BUNDLE].includes(selectedPlan.Name as any) && {
                left: <Icon size={6} className={iconColorClassName} name="servers" />,
                text: getVpnServers(vpnServersCountData.paid.servers),
            },
    ].filter(isTruthy);

    const freeName = `${VPN_SHORT_APP_NAME} Free`;
    const appName = VPN_APP_NAME;

    const hasSelectedFree = selectedPlan.Name === PLANS.FREE;

    const showStepLabel = !isB2bPlan;
    let step = 1;
    const padding = 'sm:p-11';

    const planInformation = getPlanInformation(options.plan, vpnServersCountData, mode);

    const upsellToCycle = (() => {
        if (options.plan.Name === PLANS.BUNDLE && getHas2023OfferCoupon(options.checkResult.Coupon?.Code)) {
            return;
        }
        if (options.cycle === CYCLE.MONTHLY) {
            if (cycles.includes(CYCLE.FIFTEEN)) {
                return CYCLE.FIFTEEN;
            }
            return CYCLE.YEARLY;
        }
        if (options.cycle === CYCLE.YEARLY) {
            return CYCLE.TWO_YEARS;
        }
        if (options.cycle === CYCLE.FIFTEEN) {
            return CYCLE.THIRTY;
        }
    })();

    const handleCloseUpsellModal = () => {
        handleUpdate('plan');
        if (!(options.planIDs[PLANS.VPN] || options.planIDs[PLANS.VPN_PASS_BUNDLE])) {
            withLoadingPaymentDetails(
                handleOptimistic({
                    planIDs: {
                        [PLANS.VPN]: 1,
                    },
                    cycle: cycles[0] || DEFAULT_CYCLE,
                })
            ).catch(noop);
        }
        upsellModalProps.onClose();
    };

    const upsellToVPNPassBundle = canUpsellToVPNPassBundle(
        options.planIDs,
        options.cycle,
        options.checkResult.Coupon?.Code
    );

    const addonsPricing = getAddonsPricing({
        currentPlan: options.plan,
        plansMap: model.plansMap,
        planIDs: options.planIDs,
        cycle: options.cycle,
    });

    const coupon = (() => {
        const {
            currency,
            checkResult: { Coupon, CouponDiscount },
        } = model.subscriptionData;

        if (!Coupon || !CouponDiscount) {
            return;
        }
        return {
            code: Coupon.Code,
            description: Coupon.Description,
            discount: CouponDiscount,
            currency,
        };
    })();

    const handleUpsellVPNPassBundle = () => {
        if (loadingSignup || loadingPaymentDetails) {
            return;
        }
        if (!options.planIDs[PLANS.VPN_PASS_BUNDLE]) {
            setToggleUpsell(undefined);
            return withLoadingPaymentDetails(
                handleOptimistic({
                    planIDs: {
                        [PLANS.VPN_PASS_BUNDLE]: 1,
                    },
                })
            ).catch(noop);
        } else {
            setToggleUpsell(undefined);
            return withLoadingPaymentDetails(
                handleOptimistic({
                    planIDs: {
                        [PLANS.VPN]: 1,
                    },
                })
            ).catch(noop);
        }
    };

    const vpnSubscriptionMapping = getSubscriptionMapping({
        subscriptionDataCycleMapping: model.subscriptionDataCycleMapping,
        planName: PLANS.VPN,
        planIDs: { [PLANS.VPN]: 1 },
    });

    const isBlackFriday =
        getHas2023OfferCoupon(vpnSubscriptionMapping?.[CYCLE.FIFTEEN]?.checkResult.Coupon?.Code) ||
        getHas2023OfferCoupon(options.checkResult.Coupon?.Code);

    const isCyberWeekPeriod = getIsCyberWeekPeriod();
    const isBlackFridayPeriod = getIsBlackFridayPeriod();

    const renewalNotice = !hasSelectedFree && (
        <div className="w-full text-sm color-norm opacity-70 text-center">
            <div className="mx-auto w-full md:w-7/10">
                *
                {getHas2023OfferCoupon(options.checkResult.Coupon?.Code)
                    ? getBlackFridayRenewalNoticeText({
                          price: options.checkResult.Amount + (options.checkResult.CouponDiscount || 0),
                          cycle: options.cycle,
                          plansMap: model.plansMap,
                          planIDs: options.planIDs,
                          currency: options.currency,
                      })
                    : getCheckoutRenewNoticeText({
                          cycle: options.cycle,
                          plansMap: model.plansMap,
                          planIDs: options.planIDs,
                          checkout: actualCheckout,
                          currency: options.currency,
                      }) ||
                      getRenewalNoticeText({
                          renewCycle: options.cycle,
                      })}
            </div>
        </div>
    );

    const process = (processor: PaymentProcessorHook | undefined) => {
        const isFormValid = validatePayment() && accountDetailsRef.current?.validate();
        if (!isFormValid) {
            return;
        }

        const telemetryType = (() => {
            const isFreeSignup = paymentFacade.amount <= 0;

            if (isFreeSignup) {
                return 'free';
            }

            if (processor?.meta.type === 'paypal') {
                return 'pay_pp';
            }

            if (processor?.meta.type === 'paypal-credit') {
                return 'pay_pp_no_cc';
            }

            return 'pay_cc';
        })();
        measurePaySubmit(telemetryType);

        async function run() {
            if (!processor) {
                return;
            }

            try {
                await processor.processPaymentToken();
            } catch (e) {
                observeApiError(e, (status) => {
                    measurePayError(telemetryType);
                    metrics.core_vpn_single_signup_step1_payment_2_total.increment({
                        status,
                        flow: isB2bPlan ? 'b2b' : 'b2c',
                    });
                });

                const error = getSentryError(e);
                if (error) {
                    const context = {
                        mode,
                        selectedPlan,
                        selectedPlanName: selectedPlan.Name,
                        isB2bPlan,
                        step: model.step,
                        currency: options.currency,
                        cycle: options.cycle,
                        amount: options.checkResult.AmountDue,
                        coupon,
                        processorType: paymentFacade.selectedProcessor?.meta.type,
                        paymentMethod: paymentFacade.selectedMethodType,
                        paymentMethodValue: paymentFacade.selectedMethodValue,
                        subscriptionDataType: model.subscriptionData.type,
                        paymentsVersion: getPaymentsVersion(),
                        chargebeeEnabled: chargebeeContext.enableChargebee,
                    };

                    captureMessage('Payments: Failed to handle single-signup-v1', {
                        level: 'error',
                        extra: { error, context },
                    });
                }
            }
        }

        withLoadingSignup(run()).catch(noop);
    };

    const hasSomeVpnPlan = getIsVpnPlan(options.plan.Name);

    return (
        <Layout
            hasDecoration
            footer={renewalNotice}
            className={className}
            bottomRight={
                <SignupSupportDropdown
                    isDarkBg={['dark', 'bf2023'].includes(background as any) && !viewportWidth.xsmall}
                />
            }
            background={background}
            isB2bPlan={isB2bPlan}
        >
            <div className="flex items-center flex-column">
                <div className="signup-v1-header mb-4 mt-4 md:mt-0 text-center">
                    <h1 className="m-0 large-font lg:px-4 text-semibold">
                        {(() => {
                            if (isVpn2024Deal) {
                                return c('Header').t`Save big with the best deals on ${VPN_APP_NAME}`;
                            }

                            if (isB2bPlan) {
                                return c('new_plans: feature').t`Start protecting your organization`;
                            }

                            if (isBlackFriday) {
                                if (isBlackFridayPeriod) {
                                    return c('bf2023: header')
                                        .t`Save with Black Friday deals on a high-speed Swiss VPN`;
                                }
                                if (isCyberWeekPeriod) {
                                    return c('bf2023: header').t`Save with Cyber Week deals on a high-speed Swiss VPN`;
                                }
                                return c('bf2023: header').t`Save with End of Year deals on a high-speed Swiss VPN`;
                            }

                            if (mode === 'pricing') {
                                return c('new_plans: feature').t`High-speed Swiss VPN that protects your privacy`;
                            }

                            return c('new_plans: feature').t`Start protecting yourself online in 2 easy steps`;
                        })()}
                    </h1>
                </div>
                {mode === 'pricing' && !isB2bPlan && (
                    <div
                        className={clsx(
                            'flex flex-nowrap md:gap-8 gap-3',
                            background === 'bf2023' ? 'color-norm' : 'color-weak'
                        )}
                    >
                        {features.map(({ left, text }, i, arr) => {
                            return (
                                <Fragment key={text}>
                                    <FeatureItem left={left} text={text} />
                                    {i !== arr.length - 1 && (
                                        <Vr className="h-custom" style={{ '--h-custom': '2.25rem' }} />
                                    )}
                                </Fragment>
                            );
                        })}
                    </div>
                )}
                {!hasSelectedFree && mode === 'pricing' && checkoutMappingPlanIDs && (
                    <Box className={`mt-8 w-full ${padding}`}>
                        <BoxHeader
                            step={showStepLabel ? step++ : undefined}
                            title={(() => {
                                if (isVpn2024Deal) {
                                    return c('Header').t`Select your deal`;
                                }

                                if (isBlackFriday) {
                                    if (isBlackFridayPeriod) {
                                        return c('bf2023: header').t`Select your Black Friday offer`;
                                    }
                                    if (isCyberWeekPeriod) {
                                        return c('bf2023: header').t`Select your Cyber Week offer`;
                                    }
                                    return c('bf2023: header').t`Select your End of Year offer`;
                                }
                                return c('Header').t`Select your pricing plan`;
                            })()}
                            right={
                                <CurrencySelector
                                    mode="select-two"
                                    currency={options.currency}
                                    onSelect={(currency) =>
                                        withLoadingPaymentDetails(handleChangeCurrency(currency)).catch(noop)
                                    }
                                />
                            }
                        />
                        <BoxContent>
                            {checkoutMappingPlanIDs && (
                                <div className="flex justify-space-between gap-4 flex-column lg:flex-row">
                                    <CycleSelector
                                        onGetTheDeal={(cycle) => {
                                            handleUpdate('plan');
                                            setToggleUpsell(undefined);
                                            withLoadingPaymentDetails(handleChangeCycle(cycle)).catch(noop);
                                            accountDetailsRef.current?.scrollInto('email');
                                        }}
                                        upsellCycle={upsellCycle}
                                        cycle={options.cycle}
                                        currency={options.currency}
                                        cycles={cycles}
                                        onChangeCycle={(cycle, upsellFrom) => {
                                            handleUpdate('plan');
                                            setToggleUpsell(undefined);
                                            return withLoadingPaymentDetails(
                                                handleChangeCycle(
                                                    cycle,
                                                    upsellFrom !== undefined ? 'upsell' : undefined
                                                )
                                            ).catch(noop);
                                        }}
                                        checkoutMapping={checkoutMappingPlanIDs}
                                    />
                                </div>
                            )}
                            <div className="flex flex-column items-center gap-1 lg:flex-row lg:justify-space-between mt-10">
                                <span className="text-sm">
                                    <Guarantee />
                                </span>
                                {!hideFreePlan && (
                                    <div className="color-weak">
                                        {c('Action').t`Or`}{' '}
                                        <InlineLinkButton
                                            className="color-weak"
                                            onClick={() => {
                                                void measure({
                                                    event: TelemetryAccountSignupEvents.planSelect,
                                                    dimensions: { plan: PLANS.FREE },
                                                });
                                                setUpsellModal(true);
                                            }}
                                        >
                                            {c('Action').t`sign up for free`}
                                        </InlineLinkButton>
                                    </div>
                                )}
                            </div>
                        </BoxContent>
                    </Box>
                )}
                <Box className="mt-8 w-full">
                    <div className="flex justify-space-between flex-column lg:flex-row ">
                        <div className={`lg:flex-1 ${padding}`}>
                            <BoxHeader
                                step={showStepLabel ? step++ : undefined}
                                title={c('Header').t`Create your account`}
                            ></BoxHeader>
                            <BoxContent>
                                <div className="relative">
                                    <AccountStepDetails
                                        domains={model.domains}
                                        signupTypes={[SignupType.Email]}
                                        defaultEmail={defaultEmail}
                                        passwordFields={false}
                                        model={model}
                                        measure={measure}
                                        loading={loadingChallenge}
                                        api={silentApi}
                                        accountStepDetailsRef={accountDetailsRef}
                                        onChallengeError={() => {
                                            setLoadingChallenge(false);
                                            onChallengeError();
                                        }}
                                        onChallengeLoaded={() => {
                                            setLoadingChallenge(false);
                                            onChallengeLoaded();
                                        }}
                                        disableChange={loadingSignup}
                                        onSubmit={
                                            hasSelectedFree
                                                ? () => {
                                                      withLoadingSignup(
                                                          handleCompletion(
                                                              getFreeSubscriptionData(model.subscriptionData)
                                                          )
                                                      ).catch(noop);
                                                  }
                                                : undefined
                                        }
                                        footer={(details) => {
                                            const signInTo = {
                                                pathname: `/dashboard${stringifySearchParams(
                                                    {
                                                        plan: options.plan.Name,
                                                        cycle: `${options.cycle}`,
                                                        currency: options.currency,
                                                        coupon: options.checkResult.Coupon?.Code,
                                                        type: 'offer',
                                                        ref: 'signup',
                                                    },
                                                    '?'
                                                )}`,
                                                state: {
                                                    username: details.email,
                                                },
                                            } as const;
                                            const signIn = (
                                                <Link
                                                    key="signin"
                                                    className="link link-focus text-nowrap"
                                                    to={signInTo}
                                                    onClick={() =>
                                                        measure({
                                                            event: TelemetryAccountSignupEvents.userSignIn,
                                                            dimensions: {
                                                                location: 'step2',
                                                            },
                                                        })
                                                    }
                                                >
                                                    {c('Link').t`Sign in`}
                                                </Link>
                                            );

                                            return (
                                                <>
                                                    {hasSelectedFree && (
                                                        <div className="mb-4">
                                                            <Button
                                                                type="submit"
                                                                size="large"
                                                                loading={loadingSignup}
                                                                color="norm"
                                                                fullWidth
                                                            >
                                                                {c('pass_signup_2023: Action')
                                                                    .t`Start using ${appName}`}
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <span>
                                                        {
                                                            // translator: Full sentence "Already have an account? Sign in"
                                                            c('Go to sign in').jt`Already have an account? ${signIn}`
                                                        }
                                                    </span>
                                                    {!isB2bPlan && (
                                                        <div className="mt-4 color-weak text-sm">
                                                            {c('Info')
                                                                .t`Your information is safe with us. We'll only contact you when it's required to provide our services.`}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        }}
                                    />
                                </div>
                            </BoxContent>
                        </div>
                        {planInformation && (
                            <div
                                className={clsx(
                                    'mt-8 sm:mt-0',
                                    viewportWidth['>=large']
                                        ? `${padding} w-custom border-left border-weak`
                                        : `${padding} sm:pt-0 pt-0`
                                )}
                                style={
                                    viewportWidth['>=large']
                                        ? {
                                              '--w-custom': '22.125rem',
                                          }
                                        : undefined
                                }
                            >
                                <div
                                    className={
                                        viewportWidth['>=large'] ? undefined : 'border rounded-xl border-weak p-6 '
                                    }
                                >
                                    <RightPlanSummary
                                        {...planInformation}
                                        title={getPlanTitle(planInformation.title)}
                                        removeBundle={
                                            options.planIDs[PLANS.VPN_PASS_BUNDLE] && (
                                                <Button
                                                    className="flex flex-nowrap items-center justify-center"
                                                    color="weak"
                                                    shape="outline"
                                                    size="small"
                                                    onClick={handleUpsellVPNPassBundle}
                                                >
                                                    <Icon name="trash" size={3.5} />
                                                    <span className="ml-2">{c('bf2023: Action').t`Remove`}</span>
                                                </Button>
                                            )
                                        }
                                    />
                                    {upsellToVPNPassBundle && (
                                        <VPNPassPromotionButton
                                            currency={options.currency}
                                            cycle={options.cycle}
                                            onClick={() => {
                                                handleUpsellVPNPassBundle();
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Box>
                {!hasSelectedFree && (
                    <Box className={`mt-8 w-full ${padding}`}>
                        <BoxHeader step={showStepLabel ? step++ : undefined} title={c('Header').t`Checkout`} />
                        <BoxContent>
                            <div className="flex justify-space-between md:gap-14 gap-6 flex-column lg:flex-row">
                                <div className="lg:flex-1 md:pr-1 order-1 lg:order-0">
                                    <form
                                        onFocus={(e) => {
                                            const autocomplete = e.target.getAttribute('autocomplete');
                                            if (autocomplete) {
                                                void measure({
                                                    event: TelemetryAccountSignupEvents.interactCreditCard,
                                                    dimensions: { field: autocomplete as any },
                                                });
                                            }
                                        }}
                                        name="payment-form"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            process(paymentFacade.selectedProcessor);
                                        }}
                                        method="post"
                                    >
                                        {isB2bPlan && (
                                            <>
                                                <PlanCustomizer
                                                    currency={options.currency}
                                                    cycle={options.cycle}
                                                    plansMap={model.plansMap}
                                                    planIDs={options.planIDs}
                                                    currentPlan={selectedPlan}
                                                    onChangePlanIDs={(planIDs: PlanIDs) =>
                                                        withLoadingPaymentDetails(handleOptimistic({ planIDs })).catch(
                                                            noop
                                                        )
                                                    }
                                                />
                                                <div className="border-bottom border-weak my-6" />
                                            </>
                                        )}
                                        {options.checkResult.AmountDue ? (
                                            <PaymentWrapper
                                                {...paymentFacade}
                                                disabled={loadingSignup}
                                                hideFirstLabel
                                                noMaxWidth
                                                hasSomeVpnPlan={hasSomeVpnPlan}
                                            />
                                        ) : (
                                            <div className="mb-4">{c('Info')
                                                .t`No payment is required at this time.`}</div>
                                        )}
                                        {(() => {
                                            if (
                                                paymentFacade.selectedMethodType === PAYMENT_METHOD_TYPES.PAYPAL &&
                                                options.checkResult.AmountDue > 0
                                            ) {
                                                return (
                                                    <div className="flex flex-column gap-2">
                                                        <StyledPayPalButton
                                                            paypal={paymentFacade.paypal}
                                                            amount={paymentFacade.amount}
                                                            currency={paymentFacade.currency}
                                                            loading={loadingSignup}
                                                            onClick={() => process(paymentFacade.paypal)}
                                                        />
                                                        {!hasSomeVpnPlan && (
                                                            <PayPalButton
                                                                id="paypal-credit"
                                                                shape="ghost"
                                                                color="norm"
                                                                paypal={paymentFacade.paypalCredit}
                                                                disabled={loadingSignup}
                                                                amount={paymentFacade.amount}
                                                                currency={paymentFacade.currency}
                                                                onClick={() => process(paymentFacade.paypalCredit)}
                                                            >
                                                                {c('Link').t`Paypal without credit card`}
                                                            </PayPalButton>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (
                                                paymentFacade.selectedMethodType ===
                                                    PAYMENT_METHOD_TYPES.CHARGEBEE_PAYPAL &&
                                                options.checkResult.AmountDue > 0
                                            ) {
                                                return (
                                                    <ChargebeePaypalWrapper
                                                        chargebeePaypal={paymentFacade.chargebeePaypal}
                                                        iframeHandles={paymentFacade.iframeHandles}
                                                    />
                                                );
                                            }

                                            return (
                                                <>
                                                    <Button
                                                        type="submit"
                                                        size="large"
                                                        loading={loadingSignup}
                                                        disabled={
                                                            Object.keys(model.optimistic).length > 0 ||
                                                            loadingPaymentDetails
                                                        }
                                                        color="norm"
                                                        fullWidth
                                                    >
                                                        {options.checkResult.AmountDue > 0
                                                            ? c('Action').jt`Pay ${price}`
                                                            : c('Action').t`Confirm`}
                                                    </Button>
                                                    {hasGuarantee && (
                                                        <div className="text-center color-success my-4">
                                                            <Guarantee />
                                                        </div>
                                                    )}
                                                    <Alert3ds />
                                                    <div className="mt-4 text-sm color-weak text-center">
                                                        {
                                                            // translator: Full sentence "By clicking on "Pay", you agree to our terms and conditions."
                                                            c('new_plans: signup')
                                                                .jt`By clicking on "Pay", you agree to our ${termsAndConditions}.`
                                                        }
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </form>
                                </div>
                                <div
                                    className={clsx(viewportWidth['>=large'] && 'w-custom')}
                                    style={viewportWidth['>=large'] ? { '--w-custom': '18.75rem' } : undefined}
                                >
                                    <div className="border rounded-xl border-weak px-3 py-4">
                                        <div className="flex flex-column gap-3">
                                            <div className="color-weak text-semibold mx-3">{c('Info').t`Summary`}</div>
                                            {(() => {
                                                if (!planInformation) {
                                                    return null;
                                                }

                                                const pricePerMonth = getSimplePriceString(
                                                    options.currency,
                                                    actualCheckout.withDiscountPerMonth,
                                                    ''
                                                );

                                                const regularPrice = getSimplePriceString(
                                                    options.currency,
                                                    totals.totalNoDiscountPerMonth,
                                                    ''
                                                );
                                                const free = hasSelectedFree;

                                                const hasUpsellVPNPassBundleToggle =
                                                    upsellToVPNPassBundle || options.planIDs[PLANS.VPN_PASS_BUNDLE];

                                                const getToggle = () => {
                                                    if (hasUpsellVPNPassBundleToggle) {
                                                        return (
                                                            <VPNPassUpsellToggle
                                                                checked={!!options.planIDs[PLANS.VPN_PASS_BUNDLE]}
                                                                currency={options.currency}
                                                                cycle={toggleUpsell?.from || options.cycle}
                                                                onChange={() => {
                                                                    handleUpsellVPNPassBundle();
                                                                }}
                                                            />
                                                        );
                                                    }

                                                    if (
                                                        getHas2023OfferCoupon(options.checkResult.Coupon?.Code) &&
                                                        options.cycle === CYCLE.MONTHLY
                                                    ) {
                                                        return null;
                                                    }
                                                    const toCycle = toggleUpsell?.to || upsellToCycle;
                                                    if (!toCycle) {
                                                        return null;
                                                    }
                                                    const subscriptionMapping = getSubscriptionMapping({
                                                        subscriptionDataCycleMapping:
                                                            model.subscriptionDataCycleMapping,
                                                        planName: options.plan.Name,
                                                        planIDs: options.planIDs,
                                                    });
                                                    if (!subscriptionMapping) {
                                                        return null;
                                                    }
                                                    const toCycleCheckout = getCheckoutForCycle(
                                                        options.planIDs,
                                                        subscriptionMapping,
                                                        toCycle
                                                    );
                                                    if (!toCycleCheckout) {
                                                        return null;
                                                    }
                                                    const billingCycle = getBillingCycleText(toCycle);
                                                    if (!billingCycle) {
                                                        return null;
                                                    }
                                                    const label = getOffText(
                                                        `${toCycleCheckout.discountPercent}%`,
                                                        billingCycle
                                                    );

                                                    return (
                                                        <>
                                                            <Toggle
                                                                checked={!!toggleUpsell}
                                                                id="toggle-upsell-plan"
                                                                className="mx-1"
                                                                onChange={(event) => {
                                                                    if (loadingSignup || loadingPaymentDetails) {
                                                                        return;
                                                                    }
                                                                    if (event.target.checked && upsellToCycle) {
                                                                        setToggleUpsell({
                                                                            from: options.cycle,
                                                                            to: upsellToCycle,
                                                                        });
                                                                        withLoadingPaymentDetails(
                                                                            handleChangeCycle(upsellToCycle, 'upsell')
                                                                        ).catch(noop);
                                                                    } else if (toggleUpsell) {
                                                                        withLoadingPaymentDetails(
                                                                            handleChangeCycle(
                                                                                toggleUpsell.from,
                                                                                'upsell'
                                                                            )
                                                                        ).catch(noop);
                                                                        setToggleUpsell(undefined);
                                                                    }
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor="toggle-upsell-plan"
                                                                className="flex-1 text-sm"
                                                            >
                                                                {label}
                                                            </label>
                                                        </>
                                                    );
                                                };

                                                const upsell = getToggle();

                                                return (
                                                    <div
                                                        className={clsx(
                                                            'rounded-xl flex flex-column gap-1',
                                                            upsell ? 'border border-weak' : ''
                                                        )}
                                                    >
                                                        <div className="p-2 flex gap-2">
                                                            <div>
                                                                <div
                                                                    className="inline-block border border-weak rounded-lg p-2"
                                                                    title={planInformation.title}
                                                                >
                                                                    {planInformation.logo}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex gap-2">
                                                                    <div className="text-rg text-bold flex-1">
                                                                        {planInformation.title}
                                                                    </div>
                                                                    {!isB2bPlan && (
                                                                        <div className="text-rg text-bold">
                                                                            {pricePerMonth}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 flex items-center gap-2">
                                                                    <div className="flex-1 text-sm">
                                                                        <span className="color-weak mr-1">
                                                                            {getBilledText(options.cycle)}
                                                                        </span>
                                                                        {actualCheckout.discountPercent > 0 && (
                                                                            <SaveLabel2
                                                                                className="text-sm inline-block"
                                                                                highlightPrice
                                                                            >
                                                                                {`− ${actualCheckout.discountPercent}%`}
                                                                            </SaveLabel2>
                                                                        )}
                                                                    </div>

                                                                    {free && (
                                                                        <div className="flex-1 text-sm color-weak">
                                                                            {c('Info').t`Free forever`}
                                                                        </div>
                                                                    )}

                                                                    {!isB2bPlan &&
                                                                        actualCheckout.discountPercent > 0 && (
                                                                            <span className="inline-flex">
                                                                                <span className="text-sm color-weak text-strike text-ellipsis">
                                                                                    {regularPrice}
                                                                                </span>
                                                                                <span className="text-sm color-weak ml-1">{` ${c(
                                                                                    'Suffix'
                                                                                ).t`/month`}`}</span>
                                                                            </span>
                                                                        )}

                                                                    {free && (
                                                                        <span className="text-sm color-weak ml-1">{` ${c(
                                                                            'Suffix'
                                                                        ).t`/month`}`}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {upsell && (
                                                            <>
                                                                <div className="border-top border-weak" />
                                                                <div className="p-2 flex gap-1 items-center">
                                                                    {upsell}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {addonsPricing.length > 0 ? (
                                                <>
                                                    <div className="mx-3 mt-1 flex flex-column gap-2">
                                                        {(() => {
                                                            return addonsPricing.map(
                                                                ({ addonPricePerCycle, cycle, value, addon }) => {
                                                                    if (
                                                                        addon.Name === ADDON_NAMES.MEMBER_VPN_PRO ||
                                                                        addon.Name === ADDON_NAMES.MEMBER_VPN_BUSINESS
                                                                    ) {
                                                                        return (
                                                                            <AddonSummary
                                                                                key={addon.Name}
                                                                                label={c('Checkout summary').t`Users`}
                                                                                numberOfItems={value}
                                                                                currency={options.currency}
                                                                                price={addonPricePerCycle / cycle}
                                                                                subline={
                                                                                    <>
                                                                                        /{' '}
                                                                                        {c('Checkout summary').t`month`}
                                                                                    </>
                                                                                }
                                                                            />
                                                                        );
                                                                    }

                                                                    if (addon.Name === ADDON_NAMES.IP_VPN_BUSINESS) {
                                                                        return (
                                                                            <AddonSummary
                                                                                key={addon.Name}
                                                                                label={c('Checkout summary').t`Servers`}
                                                                                numberOfItems={value}
                                                                                currency={options.currency}
                                                                                price={addonPricePerCycle / cycle}
                                                                            />
                                                                        );
                                                                    }
                                                                }
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="mx-3 border-bottom border-weak" />
                                                </>
                                            ) : null}

                                            {isB2bPlan && (
                                                <>
                                                    <div className="mx-3 text-bold flex justify-space-between text-rg gap-2">
                                                        <span>{getTotalBillingText(options.cycle)}</span>
                                                        <span>
                                                            <Price currency={options.currency}>
                                                                {options.checkResult.Amount}
                                                            </Price>
                                                        </span>
                                                    </div>
                                                    <div className="mx-3 border-bottom border-weak" />
                                                </>
                                            )}

                                            {isB2bPlan && (
                                                <>
                                                    <div className="mx-3">
                                                        <GiftCodeSummary
                                                            coupon={coupon}
                                                            onApplyCode={async (code) => {
                                                                const checkResult = await getSubscriptionPrices(
                                                                    getPaymentsApi(silentApi),
                                                                    options.planIDs,
                                                                    options.currency,
                                                                    options.cycle,
                                                                    model.subscriptionData.billingAddress,
                                                                    code
                                                                );

                                                                setModel((old) => ({
                                                                    ...old,
                                                                    subscriptionData: {
                                                                        ...model.subscriptionData,
                                                                        checkResult,
                                                                    },
                                                                }));

                                                                setCouponCode(code);

                                                                if (!checkResult.Coupon) {
                                                                    throw new Error(c('Notification').t`Invalid code`);
                                                                }
                                                            }}
                                                            onRemoveCode={async () => {
                                                                const checkResult = await getSubscriptionPrices(
                                                                    getPaymentsApi(silentApi),
                                                                    options.planIDs,
                                                                    options.currency,
                                                                    options.cycle,
                                                                    model.subscriptionData.billingAddress
                                                                );

                                                                setModel((old) => ({
                                                                    ...old,
                                                                    subscriptionData: {
                                                                        ...model.subscriptionData,
                                                                        checkResult,
                                                                    },
                                                                }));

                                                                setCouponCode(undefined);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="mx-3 border-bottom border-weak" />
                                                </>
                                            )}

                                            <div className="mx-3 flex flex-column gap-2">
                                                {paymentFacade.showTaxCountry && (
                                                    <WrappedTaxCountrySelector
                                                        onBillingAddressChange={handleChangeBillingAddress}
                                                        statusExtended={paymentFacade.statusExtended}
                                                    />
                                                )}
                                                <div
                                                    className={clsx(
                                                        'text-bold',
                                                        'flex justify-space-between text-rg gap-2'
                                                    )}
                                                >
                                                    <span>
                                                        {isB2bPlan
                                                            ? c('Info').t`Amount due`
                                                            : getTotalBillingText(options.cycle)}
                                                    </span>
                                                    <span>
                                                        {loadingPaymentDetails ? (
                                                            <CircleLoader />
                                                        ) : (
                                                            <>
                                                                <Price currency={options.currency}>
                                                                    {options.checkResult.AmountDue}
                                                                </Price>
                                                                *
                                                            </>
                                                        )}
                                                    </span>
                                                </div>

                                                {paymentFacade.showInclusiveTax && (
                                                    <InclusiveVatText
                                                        tax={options.checkResult?.Taxes?.[0]}
                                                        currency={options.currency}
                                                        className="text-sm color-weak"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </BoxContent>
                    </Box>
                )}
            </div>
            {renderUpsellModal && (
                <UpsellModal
                    img={upsellImg}
                    title={c('vpn_2step: info').t`Try ${upsellPlanName} risk-free`}
                    info={c('Info').t`If it’s not right for you, we’ll refund you.`}
                    features={[
                        getStreaming(true),
                        getCountries(
                            getPlusServers(vpnServersCountData.paid.servers, vpnServersCountData.paid.countries)
                        ),
                        getProtectDevices(VPN_CONNECTIONS),
                        getNetShield(true),
                    ]}
                    footer={
                        <>
                            <div className="flex flex-column gap-2">
                                <Button
                                    fullWidth
                                    color="norm"
                                    shape="outline"
                                    onClick={() => {
                                        upsellModalProps.onClose();
                                        void handleChangePlanIds({}, PLANS.FREE);
                                    }}
                                >
                                    {c('Info').t`Continue with ${freeName}`}
                                </Button>
                                <Button fullWidth color="norm" onClick={handleCloseUpsellModal}>
                                    {c('Info').t`Get ${upsellPlanName}`}
                                </Button>
                            </div>
                            <div className="text-center mt-6">
                                <Guarantee />
                            </div>
                        </>
                    }
                    {...upsellModalProps}
                />
            )}
        </Layout>
    );
};

export default Step1;
