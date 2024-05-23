import { extractChain } from "viem";
import { mainnet, sepolia } from "wagmi/chains";

const supportedTestnetChains = [sepolia];
const supportedChains = [mainnet, ...supportedTestnetChains];

export const isSupported = (chainId) =>
  supportedChains.some((c) => c.id === chainId);

export const isTestnet = (chainId) =>
  supportedTestnetChains.some((c) => c.id === chainId);

export const getChain = (chainId) =>
  extractChain({ id: chainId, chains: supportedChains });
