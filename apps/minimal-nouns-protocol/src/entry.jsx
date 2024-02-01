import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http, createConfig as createWagmiConfig } from "wagmi";
import { mainnet, sepolia, goerli } from "wagmi/chains";
import { injected, safe, walletConnect } from "wagmi/connectors";

import App from "./app.jsx";
import "./index.css";

const wagmiConfig = createWagmiConfig({
  chains: [mainnet, sepolia, goerli],
  connectors: [
    injected(),
    walletConnect({
      projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    }),
    safe(),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [goerli.id]: http(),
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
  </React.StrictMode>
);
