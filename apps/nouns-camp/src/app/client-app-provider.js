"use client";

import * as Sentry from "@sentry/nextjs";
import React from "react";
import { I18nProvider } from "react-aria";
import { useAccount, useReconnect } from "wagmi";
import * as Tooltip from "@shades/ui-web/tooltip";
import {
  useAccountFetch,
  useDelegateFetch,
  useDelegatesFetch,
} from "../store.js";
import {
  Provider as ConnectWalletDialogProvider,
  useWallet,
  useConnectorsWithReadyState,
} from "../hooks/wallet.js";
import { Provider as GlobalDialogsProvider } from "../hooks/global-dialogs.js";
import AppUpdateBanner from "../components/app-update-banner.js";

const dialogs = [
  {
    key: "account",
    component: React.lazy(() => import("../components/account-dialog.js")),
  },
  {
    key: "delegation",
    component: React.lazy(() => import("../components/delegation-dialog.js")),
  },
  {
    key: "proposal-drafts",
    component: React.lazy(
      () => import("../components/proposal-drafts-dialog.js"),
    ),
  },
  {
    key: "settings",
    component: React.lazy(() => import("../components/settings-dialog.js")),
  },
  {
    key: "farcaster-setup",
    component: React.lazy(
      () => import("../components/farcaster-setup-dialog.js"),
    ),
  },
];

const GlobalClientFetcher = () => {
  const { address: connectedAccountAddress } = useWallet();

  useDelegatesFetch();
  useAccountFetch(connectedAccountAddress);
  useDelegateFetch(connectedAccountAddress);
};

const WalletReconnector = () => {
  const { isConnected } = useAccount();
  const { reconnect } = useReconnect();
  const connectors = useConnectorsWithReadyState();
  React.useEffect(() => {
    if (isConnected) return;
    reconnect();
  }, [isConnected, reconnect, connectors]);
};

const SentryConfigurator = () => {
  const { address } = useAccount();
  React.useEffect(() => {
    if (address == null) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: address });
  }, [address]);
};

export default function ClientAppProvider({ children }) {
  return (
    <I18nProvider locale="en-US">
      <Tooltip.Provider delayDuration={300}>
        <ConnectWalletDialogProvider>
          <GlobalDialogsProvider dialogs={dialogs}>
            <AppUpdateBanner />
            {children}
            <GlobalClientFetcher />
            <WalletReconnector />
            <SentryConfigurator />
          </GlobalDialogsProvider>
        </ConnectWalletDialogProvider>
      </Tooltip.Provider>
    </I18nProvider>
  );
}
