import { DEFAULT_TAX_BILLING_ADDRESS } from '@proton/components/containers/payments/TaxCountrySelector';
import { CheckSubscriptionData, PaymentsVersion } from '@proton/shared/lib/api/payments';
import { PLANS } from '@proton/shared/lib/constants';
import { Api, ChargebeeEnabled, SubscriptionCheckResponse } from '@proton/shared/lib/interfaces';

import { useApi } from '../../hooks';
import { useChargebeeEnabledCache, useChargebeeKillSwitch } from '../client-extensions/useChargebeeContext';
import {
    PaymentMethodStatus,
    PaymentMethodStatusExtended,
    PaymentsApi,
    extendStatus,
    isPaymentMethodStatusExtended,
} from '../core';

const checkSubscription = (data: CheckSubscriptionData, version: PaymentsVersion) => ({
    url: `payments/${version}/subscription/check`,
    method: 'post',
    data,
});

const queryPaymentMethodStatus = (version: PaymentsVersion) => ({
    url: `payments/${version}/status`,
    method: 'get',
});

export const usePaymentsApi = (
    apiOverride?: Api
): {
    paymentsApi: PaymentsApi;
    getPaymentsApi: (api: Api, chargebeeEnabled?: ChargebeeEnabled) => PaymentsApi;
} => {
    const regularApi = useApi();
    const apiHook = apiOverride ?? regularApi;
    const { chargebeeKillSwitch } = useChargebeeKillSwitch();
    const chargebeeEnabledCache = useChargebeeEnabledCache();

    const getPaymentsApi = (api: Api, chargebeeEnabled: ChargebeeEnabled = chargebeeEnabledCache): PaymentsApi => {
        const statusExtended = async (version: PaymentsVersion): Promise<PaymentMethodStatusExtended> => {
            return api<PaymentMethodStatusExtended | PaymentMethodStatus>(queryPaymentMethodStatus(version)).then(
                (result) => {
                    if (isPaymentMethodStatusExtended(result)) {
                        if (!result.CountryCode) {
                            result.CountryCode = DEFAULT_TAX_BILLING_ADDRESS.CountryCode;
                        }

                        return result;
                    }

                    return extendStatus(result);
                }
            );
        };

        const statusExtendedAutomatic = async (): Promise<PaymentMethodStatusExtended> => {
            if (chargebeeEnabled === ChargebeeEnabled.INHOUSE_FORCED) {
                return statusExtended('v4');
            }

            if (chargebeeEnabled === ChargebeeEnabled.CHARGEBEE_FORCED) {
                return statusExtended('v5');
            }

            try {
                return await statusExtended('v5');
            } catch (error) {
                if (
                    chargebeeKillSwitch({
                        reason: 'status call failed',
                        error,
                    })
                ) {
                    return await statusExtended('v4');
                }

                throw error;
            }
        };

        const checkV4 = async (
            data: CheckSubscriptionData,
            signal?: AbortSignal
        ): Promise<SubscriptionCheckResponse> => {
            return api({
                ...checkSubscription(data, 'v4'),
                signal,
            });
        };

        const checkV5 = async (
            data: CheckSubscriptionData,
            signal?: AbortSignal
        ): Promise<SubscriptionCheckResponse> => {
            // Patch for coupons compatibility v4 vs v5
            if (!data.Codes || data.Codes.length === 0) {
                data.Codes = data.CouponCode ? [data.CouponCode] : [];
            }

            return api({
                ...checkSubscription(data, 'v5'),
                signal,
            });
        };

        const checkWithAutomaticVersion = async (
            data: CheckSubscriptionData,
            signal?: AbortSignal
        ): Promise<SubscriptionCheckResponse> => {
            if (chargebeeEnabled === ChargebeeEnabled.INHOUSE_FORCED) {
                return checkV4(data, signal);
            }

            if (chargebeeEnabled === ChargebeeEnabled.CHARGEBEE_FORCED) {
                return checkV5(data, signal);
            }

            const passB2bPlans = [PLANS.PASS_PRO, PLANS.PASS_BUSINESS];
            const isPassB2b = passB2bPlans.some((plan) => data.Plans[plan] > 0);
            if (isPassB2b) {
                return checkV4(data, signal);
            }

            try {
                return await checkV5(data, signal);
            } catch (error) {
                if (
                    chargebeeKillSwitch({
                        reason: 'check call failed',
                        data,
                        error,
                    })
                ) {
                    return await checkV4(data, signal);
                }

                throw error;
            }
        };

        return {
            checkWithAutomaticVersion,
            statusExtendedAutomatic,
        };
    };

    return {
        paymentsApi: getPaymentsApi(apiHook),
        getPaymentsApi,
    };
};
