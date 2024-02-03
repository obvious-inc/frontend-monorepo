import "./polyfills";
import React from "react";
import { createRoot } from "react-dom/client";
import { CacheStoreProvider, createCacheStore } from "@shades/common/app";
import { ChainDataCacheContextProvider } from "./hooks/farcord";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
  mainnet,
} from "wagmi";
import { optimism } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

import "./reset.css";
import "./index.css";

const isProduction = import.meta.env.NODE_ENV === "production";

const LazyApp = React.lazy(() => import("./app"));

const App = () => {
  return (
    <React.Suspense fallback={null}>
      <LazyApp />
    </React.Suspense>
  );
};

let cacheStoreStorage;
try {
  // This might throw in contexts where storage access isn’t allowed
  cacheStoreStorage = window.localStorage;
} catch (e) {
  console.warn(e);
}

const { chains, publicClient } = configureWagmiChains(
  [optimism, mainnet],
  [
    infuraProvider({ apiKey: import.meta.env.PUBLIC_INFURA_PROJECT_ID }),
    publicProvider(),
  ]
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: import.meta.env.PUBLIC_WALLET_CONNECT_PROJECT_ID,
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: "Farcord",
      },
    }),
  ],
});

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <ChainDataCacheContextProvider>
        <CacheStoreProvider
          store={createCacheStore({ storage: cacheStoreStorage })}
        >
          <App />
          {isProduction && <VercelAnalytics />}
        </CacheStoreProvider>
      </ChainDataCacheContextProvider>
    </WagmiConfig>
  </React.StrictMode>
);
