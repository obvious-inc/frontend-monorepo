import { mainnet, sepolia } from "wagmi/chains";
import { useNetwork } from "wagmi";

const supportedChainIds = [mainnet.id, sepolia.id];

const useChainId = () => {
  const { chain } = useNetwork();
  if (chain == null || !supportedChainIds.includes(chain.id)) return mainnet.id;

  return chain.id;
};

export const useConnectedChainId = () => useNetwork().chain?.id;

export default useChainId;
