"use client";

import { useEffect } from "react";
import ClientAppProvider from "@/app/client-app-provider";
import { build as buildMetadata } from "@/utils/metadata";
import NounScreen from "@/components/noun-screen";

export const runtime = "edge";

export const metadata = buildMetadata({
  title: "Auction",
  canonicalPathname: "/auction",
});

export default function Page() {
  useEffect(() => {
    // Temporary redirect to main site
    window.location.href = "https://lilnouns.wtf";
  }, []);

  return (
    <ClientAppProvider>
      <NounScreen />
    </ClientAppProvider>
  );
}
