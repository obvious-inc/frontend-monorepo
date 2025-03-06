"use client";

import ClientAppProvider from "@/app/client-app-provider";
import VoterScreen from "@/components/voter-screen";

// export const runtime = "edge";

export default function Page({ params }) {
  return (
    <ClientAppProvider>
      <VoterScreen voterId={params.id} />
    </ClientAppProvider>
  );
}
