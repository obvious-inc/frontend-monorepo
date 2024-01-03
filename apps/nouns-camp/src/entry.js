import React from "react";
import { createRoot } from "react-dom/client";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
// import { infuraProvider } from "wagmi/providers/infura";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { createCacheStore, CacheStoreProvider } from "@shades/common/app";
import App from "./app.js";
import "./reset.css";
import "./index.css";

const isProduction = process.env.NODE_ENV === "production";

const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js");
    });
  }
};

const unregisterServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) registration.unregister();
    });
  }
};

if (process.env.NODE_ENV === "production") {
  registerServiceWorker();
} else {
  unregisterServiceWorker();
}

let cacheStoreStorage;
try {
  // This might throw in contexts where storage access isn’t allowed
  cacheStoreStorage = window.localStorage;
} catch (e) {
  console.warn(e);
}

const { chains, publicClient } = configureWagmiChains(
  [mainnet, sepolia],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY }),
    // infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }),
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
        projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      },
    }),
    new CoinbaseWalletConnector({
      options: {
        appName: "nouns.camp",
        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    }),
  ],
});

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <CacheStoreProvider
        store={createCacheStore({ storage: cacheStoreStorage })}
      >
        <App />
        {isProduction && <VercelAnalytics />}
      </CacheStoreProvider>
    </WagmiConfig>
  </React.StrictMode>
);
