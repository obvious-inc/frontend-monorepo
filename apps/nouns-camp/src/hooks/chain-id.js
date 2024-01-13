import { mainnet, sepolia, goerli } from "wagmi/chains";
import { useNetwork } from "wagmi";

export const defaultChainId = mainnet.id;

const supportedTestnetChainIds = [sepolia.id, goerli.id];

const supportedChainIds = [defaultChainId, ...supportedTestnetChainIds];

const useChainId = () => {
  const { chain } = useNetwork();

  if (chain == null || !supportedChainIds.includes(chain.id))
    return defaultChainId;

  return chain.id;
};

export const useConnectedChainId = () => useNetwork().chain?.id;

export default useChainId;
