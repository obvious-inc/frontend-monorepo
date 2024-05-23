import { useEnsName as useEnsName_ } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

const useEnsName = (address, { enabled = true, ...options } = {}) => {
  const { data: name } = useEnsName_({
    address,
    chainId: CHAIN_ID,
    query: {
      enabled,
    },
    ...options,
  });
  return name;
};

export default useEnsName;
