interface Client {
    title: string;
    link: string;
    icon:
        | 'brand-chrome'
        | 'brand-android'
        | 'brand-apple'
        | 'brand-brave'
        | 'brand-firefox'
        | 'brand-edge'
        | 'brand-windows';
}

export enum Clients {
    Windows,
    Android,
    iOS,
    Chrome,
    Brave,
    Firefox,
    Edge,
}

export const getDownloadablePassClients = ({
    includeWindows = true,
}: {
    includeWindows?: boolean;
} = {}): { [key in Clients]: Client } => {
    return {
        [Clients.Windows]: {
            title: 'Windows',
            link: includeWindows ? 'https://proton.me/download/PassDesktop/win32/x64/ProtonPass_Setup.exe' : '',
            icon: 'brand-windows',
        },
        [Clients.Android]: {
            title: 'Android',
            link: 'https://play.google.com/store/apps/details?id=proton.android.pass',
            icon: 'brand-android',
        },
        [Clients.iOS]: {
            title: 'iOS',
            link: 'https://apps.apple.com/us/app/id6443490629',
            icon: 'brand-apple',
        },
        [Clients.Chrome]: {
            title: 'Chrome',
            link: 'https://chrome.google.com/webstore/detail/proton-pass/ghmbeldphafepmbegfdlkpapadhbakde',
            icon: 'brand-chrome',
        },
        [Clients.Brave]: {
            title: 'Brave',
            link: 'https://chrome.google.com/webstore/detail/proton-pass/ghmbeldphafepmbegfdlkpapadhbakde',
            icon: 'brand-brave',
        },
        [Clients.Edge]: {
            title: 'Edge',
            link: 'https://chrome.google.com/webstore/detail/proton-pass/ghmbeldphafepmbegfdlkpapadhbakde',
            icon: 'brand-edge',
        },
        [Clients.Firefox]: {
            title: 'Firefox',
            link: 'https://addons.mozilla.org/en-US/firefox/addon/proton-pass',
            icon: 'brand-firefox',
        },
    } as const;
};

export const clients = getDownloadablePassClients();
