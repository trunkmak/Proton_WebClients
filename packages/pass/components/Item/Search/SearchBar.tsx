import { type FC, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { c } from 'ttag';

import { Button, Input } from '@proton/atoms';
import { Icon } from '@proton/components/components';
import { useBulkSelect } from '@proton/pass/components/Bulk/BulkSelectProvider';
import { usePassCore } from '@proton/pass/components/Core/PassCoreProvider';
import { getItemTypeOptions } from '@proton/pass/components/Item/Filters/Type';
import { useNavigation } from '@proton/pass/components/Navigation/NavigationProvider';
import { useDebouncedValue } from '@proton/pass/hooks/useDebouncedValue';
import { createTelemetryEvent } from '@proton/pass/lib/telemetry/event';
import { selectShare } from '@proton/pass/store/selectors';
import type { MaybeNull, ShareType } from '@proton/pass/types';
import { TelemetryEventName } from '@proton/pass/types/data/telemetry';
import { isEmptyString } from '@proton/pass/utils/string/is-empty-string';

import './SearchBar.scss';

type Props = {
    disabled?: boolean;
    initial?: MaybeNull<string>;
    trash?: boolean;
};

const SEARCH_DEBOUNCE_TIME = 75;

const SearchBarRaw: FC<Props> = ({ disabled, initial, trash }) => {
    const { onTelemetry } = usePassCore();
    const { filters, setFilters, matchTrash } = useNavigation();
    const bulk = useBulkSelect();

    const [search, setSearch] = useState<string>(initial ?? '');
    const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_TIME);

    const inputRef = useRef<HTMLInputElement>(null);
    const { selectedShareId, type = '*' } = filters;

    const vault = useSelector(selectShare<ShareType.Vault>(selectedShareId));

    const placeholder = useMemo(() => {
        const ITEM_TYPE_TO_LABEL_MAP = getItemTypeOptions();
        const pluralItemType = ITEM_TYPE_TO_LABEL_MAP[type].label.toLowerCase();
        const vaultName = matchTrash ? c('Label').t`Trash` : vault?.content.name.trim();

        switch (type) {
            case '*':
                return vault || matchTrash
                    ? c('Placeholder').t`Search in ${vaultName}`
                    : c('Placeholder').t`Search in all vaults`;
            default: {
                // translator: ${pluralItemType} can be either "logins", "notes", "aliases", or "cards". Full sentence example: "Search notes in all vaults"
                return vault || matchTrash
                    ? c('Placeholder').t`Search ${pluralItemType} in ${vaultName}`
                    : c('Placeholder').t`Search ${pluralItemType} in all vaults`;
            }
        }
    }, [vault, type, matchTrash]);

    const handleClear = () => {
        setSearch('');
        setFilters({ search: '' });
        inputRef.current?.focus();
    };

    const handleFocus = () => {
        bulk.lock();
        inputRef.current?.select();
    };

    const handleBlur = () => {
        bulk.unlock();
        if (isEmptyString(search)) return;
        void onTelemetry(createTelemetryEvent(TelemetryEventName.SearchTriggered, {}, {}));
    };

    useEffect(() => handleFocus(), []);
    useEffect(() => setFilters({ search: debouncedSearch }), [debouncedSearch]);
    useEffect(() => setSearch(filters.search), [filters.search]);

    return (
        <Input
            autoFocus
            className="pass-searchbar"
            inputClassName="text-rg"
            disabled={disabled}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onValue={setSearch}
            placeholder={`${trash ? c('Placeholder').t`Search in Trash` : placeholder}…`}
            prefix={<Icon name="magnifier" />}
            ref={inputRef}
            suffix={
                search !== '' && (
                    <Button
                        shape="ghost"
                        size="small"
                        color="weak"
                        icon
                        pill
                        onClick={handleClear}
                        title={c('Action').t`Clear search`}
                    >
                        <Icon name="cross" />
                    </Button>
                )
            }
            value={search}
        />
    );
};

export const SearchBar = memo(SearchBarRaw);
