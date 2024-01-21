import { type FC17, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { c } from 'ttag';

import { Button } from '@proton/atoms/Button';
import { Dropdown, DropdownMenu, DropdownMenuButton, Icon, usePopperAnchor } from '@proton/components/components';
import { DropdownMenuButtonLabel } from '@proton/pass/components/Layout/Dropdown/DropdownMenuButton';
import { itemTypeToIconName } from '@proton/pass/components/Layout/Icon/ItemIcon';
import { itemTypeToSubThemeClassName } from '@proton/pass/components/Layout/Theme/types';
import { usePasswordContext } from '@proton/pass/components/Password/PasswordProvider';
import { useCopyToClipboard } from '@proton/pass/hooks/useCopyToClipboard';
import { selectAliasLimits, selectPassPlan } from '@proton/pass/store/selectors';
import type { ItemType, MaybeNull } from '@proton/pass/types';
import { UserPassPlan } from '@proton/pass/types/api/plan';
import { pipe } from '@proton/pass/utils/fp/pipe';
import noop from '@proton/utils/noop';

type Props = {
    disabled?: boolean;
    /** Current origin if in the extension to hydrate the generated
     * password origin on save */
    origin?: MaybeNull<string>;
    onCreate: (type: ItemType) => void;
};

export const ItemQuickActions: FC17<Props> = ({ disabled = false, origin = null, onCreate }) => {
    const passwordContext = usePasswordContext();
    const copyToClipboard = useCopyToClipboard();

    const { needsUpgrade, aliasLimit, aliasLimited, aliasTotalCount } = useSelector(selectAliasLimits);
    const isFreePlan = useSelector(selectPassPlan) === UserPassPlan.FREE;

    const { anchorRef, isOpen, toggle, close } = usePopperAnchor<HTMLButtonElement>();
    const withClose = <T extends (...args: any[]) => void>(action: T) => pipe(action, close) as T;

    const handleNewPasswordClick = () => {
        void passwordContext.generate({
            actionLabel: c('Action').t`Copy and close`,
            className: 'ui-red',
            onSubmit: (value) => {
                passwordContext.history.add({ value, origin });
                copyToClipboard(value).catch(noop);
            },
        });
    };

    const quickActions = useMemo(
        () =>
            [
                { label: c('Label').t`Login`, type: 'login' },
                { label: c('Label').t`Alias`, type: 'alias' },
                { label: c('Label').t`Card`, type: 'creditCard' },
                { label: c('Label').t`Note`, type: 'note' },
            ] as const,
        []
    );

    return (
        <>
            <Button
                icon
                pill
                color="norm"
                disabled={disabled}
                onClick={toggle}
                ref={anchorRef}
                size="small"
                title={c('Action').t`Add new item`}
            >
                <Icon name="plus" alt={c('Action').t`Add new item`} />
            </Button>
            <Dropdown
                isOpen={isOpen}
                anchorRef={anchorRef}
                autoClose={false}
                onClose={close}
                originalPlacement="bottom-start"
            >
                <DropdownMenu>
                    {quickActions.map(({ type, label }) => (
                        <DropdownMenuButton
                            key={`item-type-dropdown-button-${type}`}
                            className={itemTypeToSubThemeClassName[type]}
                            onClick={withClose(() => onCreate(type))}
                            disabled={isFreePlan && type === 'creditCard'}
                        >
                            <DropdownMenuButtonLabel
                                label={label}
                                extra={
                                    type === 'alias' && aliasLimited ? (
                                        <span
                                            className={needsUpgrade ? 'color-danger' : 'color-weak'}
                                        >{`(${aliasTotalCount}/${aliasLimit})`}</span>
                                    ) : undefined
                                }
                                icon={
                                    <span
                                        className="mr-2 w-custom h-custom rounded-lg overflow-hidden relative pass-item-icon shrink-0"
                                        style={{ '--w-custom': `2em`, '--h-custom': `2em` }}
                                    >
                                        <Icon
                                            name={itemTypeToIconName[type]}
                                            className="absolute inset-center"
                                            color="var(--interaction-norm)"
                                        />
                                    </span>
                                }
                            />
                        </DropdownMenuButton>
                    ))}

                    <DropdownMenuButton className="ui-red" onClick={withClose(handleNewPasswordClick)}>
                        <DropdownMenuButtonLabel
                            label={c('Label').t`Password`}
                            icon={
                                <span
                                    className="mr-2 w-custom h-custom rounded-lg overflow-hidden relative pass-item-icon shrink-0"
                                    style={{ '--w-custom': `2em`, '--h-custom': `2em` }}
                                >
                                    <Icon
                                        name="key"
                                        className="absolute inset-center"
                                        color="var(--interaction-norm)"
                                    />
                                </span>
                            }
                        />
                    </DropdownMenuButton>
                </DropdownMenu>
            </Dropdown>
        </>
    );
};
