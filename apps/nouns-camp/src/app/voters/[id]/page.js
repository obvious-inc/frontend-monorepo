"use client";
import { use } from "react";

import ClientAppProvider from "@/app/client-app-provider";
import VoterScreen from "@/components/voter-screen";

// export const runtime = "edge";

export default function Page(props) {
  const params = use(props.params);
  return (
    <ClientAppProvider>
      <VoterScreen voterId={params.id} />
    </ClientAppProvider>
  );
}
