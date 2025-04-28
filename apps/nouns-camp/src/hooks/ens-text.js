import { useEnsText as useEnsText_ } from "wagmi";
import { CHAIN_ID } from "@/constants/env";

// Hook to fetch a specific ENS text record for an address or ENS name
const useEnsText = (
  nameOrAddress,
  key,
  { enabled = true, ...options } = {},
) => {
  const {
    data: text,
    isLoading,
    error,
  } = useEnsText_({
    name: nameOrAddress,
    key,
    chainId: CHAIN_ID,
    query: {
      enabled,
      ...options,
    },
  });

  return { text, isLoading, error };
};

export default useEnsText;
