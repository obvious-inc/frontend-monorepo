import { useAccount, useConnect } from "wagmi";

const impersonationAddress = new URLSearchParams(location.search).get(
  "impersonate"
);

export const useWallet = () => {
  const { address } = useAccount();
  const { connect, connectors, isLoading, reset } = useConnect();
  const requestAccess = () =>
    connect({ connector: connectors.find((c) => c.ready) });

  return {
    address: impersonationAddress ?? address,
    requestAccess,
    isLoading,
    reset,
  };
};
