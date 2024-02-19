"use client";

import { useWallet } from "../../../hooks/wallet.js";
import ClientAppProvider from "../../client-app-provider.js";
import ProposeScreen from "../../../components/propose-screen.js";
import ConnectWalletScreen from "../../../components/connect-wallet-screen.js";

export const runtime = "edge";

export default function Page({ params }) {
  const draftId = params.segments?.[0];
  return (
    <ClientAppProvider>
      <RequireConnectedAccount>
        <ProposeScreen draftId={draftId} />
      </RequireConnectedAccount>
    </ClientAppProvider>
  );
}

const RequireConnectedAccount = ({ children }) => {
  const { address: connectedAccountAddress } = useWallet();

  if (connectedAccountAddress == null) return <ConnectWalletScreen />;

  return children;
};
