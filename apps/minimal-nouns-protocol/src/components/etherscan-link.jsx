import { useAccount, useChains } from "wagmi";

const useCurrentChain = () => {
  const { chainId, chain } = useAccount();
  const chains = useChains();
  if (chainId != null) return chain;
  return chains[0];
};

const useBlockExplorerUrl = () => {
  const chain = useCurrentChain();
  if (chain == null) return null;
  return chain.blockExplorers.default?.url;
};

const EtherscanLink = ({ address, ...props }) => {
  const blockExplorerUrl = useBlockExplorerUrl();
  return (
    <a
      href={`${blockExplorerUrl}/address/${address}`}
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  );
};

export default EtherscanLink;
