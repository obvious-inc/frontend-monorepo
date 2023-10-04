import { useNetwork } from "wagmi";

const DEFAULT_CHAIN_ID = 1;

const useChainId = () => {
  const { chain } = useNetwork();
  return chain?.id ?? DEFAULT_CHAIN_ID;
};

export default useChainId;
