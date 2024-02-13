"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider as WagmiProvider_ } from "wagmi";
import { config } from "./wagmi-config.js";

export default function WagmiProvider({ children, initialState }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <WagmiProvider_ config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider_>
  );
}
