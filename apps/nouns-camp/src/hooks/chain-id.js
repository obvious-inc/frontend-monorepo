import { mainnet, sepolia, goerli } from "wagmi/chains";
import { useAccount } from "wagmi";

export const defaultChainId = mainnet.id;

const supportedTestnetChainIds = [sepolia.id, goerli.id];

const supportedChainIds = [defaultChainId, ...supportedTestnetChainIds];

const useChainId = () => {
  const { chainId } = useAccount();

  if (chainId == null || !supportedChainIds.includes(chainId))
    return defaultChainId;

  return chainId;
};

export const useConnectedChainId = () => useAccount().chainId;

export default useChainId;
