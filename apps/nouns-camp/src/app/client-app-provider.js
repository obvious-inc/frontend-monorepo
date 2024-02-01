import React from "react";
import { I18nProvider } from "react-aria";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet, sepolia, goerli } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import * as Tooltip from "@shades/ui-web/tooltip";
import { useDelegatesFetch } from "../store.js";
import { Provider as ConnectWalletDialogProvider } from "../hooks/wallet.js";
import { Provider as GlobalDialogsProvider } from "../hooks/global-dialogs.js";

const { chains, publicClient } = configureWagmiChains(
  [mainnet, sepolia, goerli],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY }),
    publicProvider(),
  ],
  {
    batch: {
      multicall: {
        wait: 250,
        batchSize: 1024 * 8, // 8kb seems to be the max size for cloudflare
      },
    },
  }
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
      },
    }),
    new CoinbaseWalletConnector({
      options: {
        appName: "nouns.camp",
        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      },
    }),
  ],
});

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

export default function ClientAppProvider({ children }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <I18nProvider locale="en-US">
        <Tooltip.Provider delayDuration={300}>
          <ConnectWalletDialogProvider>
            <GlobalDialogsProvider dialogs={dialogs}>
              {children}
              <GlobalClientFetches />
            </GlobalDialogsProvider>
          </ConnectWalletDialogProvider>
        </Tooltip.Provider>
      </I18nProvider>
    </WagmiConfig>
  );
}
