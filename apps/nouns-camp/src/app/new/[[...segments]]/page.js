"use client";

import { useWallet } from "../../../hooks/wallet.js";
import ClientAppProvider from "../../client-app-provider.js";
import ProposalOrTopicEditorScreen from "../../../components/proposal-or-topic-editor-screen.js";
import ConnectWalletScreen from "../../../components/connect-wallet-screen.js";

export default function Page({ params }) {
  const draftId = params.segments?.[0];
  return (
    <ClientAppProvider>
      <RequireConnectedAccount>
        <ProposalOrTopicEditorScreen draftId={draftId} />
      </RequireConnectedAccount>
    </ClientAppProvider>
  );
}

const RequireConnectedAccount = ({ children }) => {
  const { address: connectedAccountAddress } = useWallet();

  if (connectedAccountAddress == null) return <ConnectWalletScreen />;

  return children;
};
