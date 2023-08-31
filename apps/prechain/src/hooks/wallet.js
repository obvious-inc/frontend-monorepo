import { useAccount, useConnect } from "wagmi";

export const useWallet = () => {
  const { address } = useAccount();
  const { connect, connectors, isLoading, reset } = useConnect();
  const requestAccess = () =>
    connect({ connector: connectors.find((c) => c.ready) });

  return { address, requestAccess, isLoading, reset };
};
