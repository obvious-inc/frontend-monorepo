import "./polyfills";
import React from "react";
import { createRoot } from "react-dom/client";
import { CacheStoreProvider, createCacheStore } from "@shades/common/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http, createConfig as createWagmiConfig } from "wagmi";
import { walletConnect, coinbaseWallet } from "wagmi/connectors";
import { mainnet, optimism } from "wagmi/chains";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import { ChainDataCacheContextProvider } from "./hooks/farcord";

import "./reset.css";
import "./index.css";

const LazyApp = React.lazy(() => import("./app"));

if (import.meta.env.PROD) injectVercelAnalytics();

let cacheStoreStorage;
try {
  // This might throw in contexts where storage access isn’t allowed
  cacheStoreStorage = window.localStorage;
} catch (e) {
  console.warn(e);
}

const wagmiConfig = createWagmiConfig({
  chains: [mainnet, optimism],
  connectors: [
    walletConnect({
      projectId: import.meta.env.PUBLIC_WALLET_CONNECT_PROJECT_ID,
    }),
    coinbaseWallet({ appName: "Farcord" }),
  ],
  transports: {
    [mainnet.id]: http(
      `https://mainnet.infura.io/v3/${import.meta.env.PUBLIC_INFURA_PROJECT_ID}`
    ),
    [optimism.id]: http(
      `https://optimism-mainnet.infura.io/v3/${
        import.meta.env.PUBLIC_INFURA_PROJECT_ID
      }`
    ),
    //
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainDataCacheContextProvider>
          <CacheStoreProvider
            store={createCacheStore({ storage: cacheStoreStorage })}
          >
            <React.Suspense fallback={null}>
              <LazyApp />
            </React.Suspense>
          </CacheStoreProvider>
        </ChainDataCacheContextProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
