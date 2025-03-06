import { buildEtherscanLink } from "@/utils/etherscan";

const ChainExplorerTransactionLink = ({ transactionHash, ...props }) => (
  <a
    href={buildEtherscanLink(`/tx/${transactionHash}`)}
    target="_blank"
    rel="norefferer"
    {...props}
  />
);

export default ChainExplorerTransactionLink;
