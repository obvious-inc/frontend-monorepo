"use client";

import React from "react";
import { I18nProvider } from "react-aria";
import * as Tooltip from "@shades/ui-web/tooltip";
import { Provider as StoreProvider, useDelegatesFetch } from "../store.js";
import { Provider as ConnectWalletDialogProvider } from "../hooks/wallet.js";
import { Provider as GlobalDialogsProvider } from "../hooks/global-dialogs.js";
import AppUpdateBanner from "../components/app-update-banner.js";

const dialogs = [
  {
    key: "account",
    component: React.lazy(() => import("../components/account-dialog.js")),
  },
  {
    key: "settings",
    component: React.lazy(() => import("../components/settings-dialog.js")),
  },
];

const GlobalClientFetches = () => {
  useDelegatesFetch();
};

export default function ClientAppProvider({ initialStoreState, children }) {
  return (
    <I18nProvider locale="en-US">
      <Tooltip.Provider delayDuration={300}>
        <StoreProvider initialState={initialStoreState}>
          <ConnectWalletDialogProvider>
            <GlobalDialogsProvider dialogs={dialogs}>
              <AppUpdateBanner />
              {children}
              <GlobalClientFetches />
            </GlobalDialogsProvider>
          </ConnectWalletDialogProvider>
        </StoreProvider>
      </Tooltip.Provider>
    </I18nProvider>
  );
}
