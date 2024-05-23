import { useAccountDisplayName as useAccountDisplayName_ } from "@shades/common/ethereum-react";
import { CHAIN_ID } from "../constants/env.js";

const useAccountDisplayName = (address, options) => {
  const name = useAccountDisplayName_(address, {
    chainId: CHAIN_ID,
    ...options,
  });
  return name;
};

export default useAccountDisplayName;
