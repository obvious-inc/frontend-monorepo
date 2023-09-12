import React from "react";
import { createRoot } from "react-dom/client";
import { CacheStoreProvider } from "@shades/common/app";
import { ChainDataCacheContextProvider } from "./hooks/farcord.js";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
} from "wagmi";
import { optimism } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import "./reset.css";
import "./index.css";

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
  [optimism],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      },
    }),
  ],
});

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <ChainDataCacheContextProvider>
        <CacheStoreProvider syncStorage={cacheStoreStorage}>
          <App />
        </CacheStoreProvider>
      </ChainDataCacheContextProvider>
    </WagmiConfig>
  </React.StrictMode>
);
