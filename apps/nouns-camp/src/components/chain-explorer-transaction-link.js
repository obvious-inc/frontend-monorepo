import { buildEtherscanLink } from "../utils/etherscan.js";

const ChainExplorerTransactionLink = ({ transactionHash, ...props }) => (
  <a
    href={buildEtherscanLink(`/tx/${transactionHash}`)}
    target="_blank"
    rel="norefferer"
    {...props}
  />
);

export default ChainExplorerTransactionLink;
