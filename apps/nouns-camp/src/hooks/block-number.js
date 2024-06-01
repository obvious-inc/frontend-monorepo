import { useBlockNumber as useBlockNumberWagmi } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

const useBlockNumber = (options) => {
  const { data: blockNumber } = useBlockNumberWagmi({
    chainId: CHAIN_ID,
    ...options,
  });
  return blockNumber;
};

export default useBlockNumber;
