"use client";

import ClientAppProvider from "../../client-app-provider.js";
import VoterScreen from "../../../components/voter-screen.js";

export const runtime = "edge";

export default function Page({ params }) {
  return (
    <ClientAppProvider>
      <VoterScreen voterId={params.id} />
    </ClientAppProvider>
  );
}
