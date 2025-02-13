import { ReactNode, Ref, forwardRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import {
    Breakpoints,
    DrawerApp,
    InboxDesktopFreeTrialTopBanner,
    InboxDesktopOutdatedAppTopBanner,
    PrivateAppContainer,
    TopBanners,
    useUser,
} from '@proton/components';
import { APPS } from '@proton/shared/lib/constants';
import { isElectronApp } from '@proton/shared/lib/helpers/desktop';
import { Recipient } from '@proton/shared/lib/interfaces';

import { useMailDispatch } from 'proton-mail/store/hooks';

import { MESSAGE_ACTIONS } from '../../constants';
import { useOnCompose, useOnMailTo } from '../../containers/ComposeProvider';
import { ComposeTypes } from '../../hooks/composer/useCompose';
import { layoutActions } from '../../store/layout/layoutSlice';
import MailQuickSettings from '../drawer/MailQuickSettings';
import MailSidebar from '../sidebar/MailSidebar';

interface Props {
    children: ReactNode;
    breakpoints: Breakpoints;
    labelID: string;
    elementID: string | undefined;
}

const PrivateLayout = ({ children, labelID }: Props, ref: Ref<HTMLDivElement>) => {
    const location = useLocation();
    const dispatch = useMailDispatch();
    const onCompose = useOnCompose();
    const onMailTo = useOnMailTo();

    const [user] = useUser();

    const handleContactsCompose = (emails: Recipient[], attachments: File[]) => {
        onCompose({
            type: ComposeTypes.newMessage,
            action: MESSAGE_ACTIONS.NEW,
            referenceMessage: { data: { ToList: emails }, draftFlags: { initialAttachments: attachments } },
        });
    };

    useEffect(() => {
        dispatch(layoutActions.setSidebarExpanded(false));
    }, [location.pathname, location.hash]);

    const top = (
        <>
            {isElectronApp && <InboxDesktopOutdatedAppTopBanner />}
            {isElectronApp && !user.hasPaidMail && <InboxDesktopFreeTrialTopBanner />}
            <TopBanners app={APPS.PROTONMAIL} />
        </>
    );

    const sidebar = <MailSidebar labelID={labelID} />;

    return (
        <PrivateAppContainer
            top={top}
            sidebar={sidebar}
            containerRef={ref}
            drawerApp={
                <DrawerApp
                    onCompose={handleContactsCompose}
                    onMailTo={onMailTo}
                    customAppSettings={<MailQuickSettings />}
                />
            }
        >
            {children}
        </PrivateAppContainer>
    );
};

export default forwardRef(PrivateLayout);
