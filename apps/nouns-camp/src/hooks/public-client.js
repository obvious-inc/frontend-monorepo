import { usePublicClient as usePublicClient_ } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

const usePublicClient = (options) => {
  return usePublicClient_({
    chainId: CHAIN_ID,
    ...options,
  });
};

export default usePublicClient;
