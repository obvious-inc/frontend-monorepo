"use client";

import ClientAppProvider from "../../client-app-provider.js";
import CandidateScreen from "../../../components/proposal-candidate-screen.js";

export const runtime = "edge";

export default function Page({ params }) {
  return (
    <ClientAppProvider>
      <CandidateScreen candidateId={params.id} />
    </ClientAppProvider>
  );
}
