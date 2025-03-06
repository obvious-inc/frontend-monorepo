import { usePublicClient as usePublicClient_ } from "wagmi";
import { CHAIN_ID } from "@/constants/env";

const usePublicClient = (options) => {
  return usePublicClient_({
    chainId: CHAIN_ID,
    ...options,
  });
};

export default usePublicClient;
