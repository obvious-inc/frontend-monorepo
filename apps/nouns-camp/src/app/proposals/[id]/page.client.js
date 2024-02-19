"use client";

import React from "react";
import ClientAppProvider from "../../client-app-provider.js";
import ProposalScreen from "../../../components/proposal-screen.js";

export default function Page({ params }) {
  return (
    <ClientAppProvider>
      <ProposalScreen proposalId={params.id} />
    </ClientAppProvider>
  );
}
