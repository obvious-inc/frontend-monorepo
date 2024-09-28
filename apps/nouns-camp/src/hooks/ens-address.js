import { normalize } from "viem/ens";
import { useEnsAddress as useEnsAddress_ } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

const useEnsAddress = (name, { enabled = true, ...options } = {}) => {
  const nameQuery = (() => {
    if (!enabled) return null;
    try {
      return normalize(name);
    } catch (e) {
      return null;
    }
  })();

  const { data: address } = useEnsAddress_({
    name: nameQuery,
    chainId: CHAIN_ID,
    query: {
      enabled,
    },
    ...options,
  });
  return address;
};

export default useEnsAddress;
