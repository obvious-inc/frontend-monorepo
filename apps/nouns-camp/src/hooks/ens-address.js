import { useEnsAddress as useEnsAddress_ } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

const useEnsAddress = (name, { enabled = true, ...options } = {}) => {
  const { data: address } = useEnsAddress_({
    name,
    chainId: CHAIN_ID,
    query: {
      enabled,
    },
    ...options,
  });
  return address;
};

export default useEnsAddress;
