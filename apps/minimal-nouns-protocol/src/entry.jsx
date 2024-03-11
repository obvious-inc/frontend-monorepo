import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http, createConfig as createWagmiConfig } from "wagmi";
import { mainnet, sepolia, goerli } from "wagmi/chains";
import {
  walletConnect,
  // coinbaseWallet,
  safe,
  injected,
} from "wagmi/connectors";

import App from "./app.jsx";
import "./index.css";

const wagmiConfig = createWagmiConfig({
  chains: [mainnet, sepolia, goerli],
  connectors: [
    walletConnect({
      projectId: import.meta.env.PUBLIC_WALLET_CONNECT_PROJECT_ID,
    }),
    // coinbaseWallet({ appName: "Nouns Camp" }),
    safe(),
    injected(),
  ],
  transports: {
    [mainnet.id]: http(
      `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.PUBLIC_ALCHEMY_API_KEY}`,
    ),
    [sepolia.id]: http(
      `https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.PUBLIC_ALCHEMY_API_KEY}`,
    ),
    [goerli.id]: http(
      `https://eth-goerli.g.alchemy.com/v2/${import.meta.env.PUBLIC_ALCHEMY_API_KEY}`,
    ),
  },
  batch: {
    multicall: {
      wait: 250,
      batchSize: 1024 * 8, // 8kb seems to be the max size for cloudflare
    },
  },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
