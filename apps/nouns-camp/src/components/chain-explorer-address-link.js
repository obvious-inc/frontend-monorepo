import { buildEtherscanLink } from "@/utils/etherscan";

const ChainExplorerAddressLink = ({ address, ...props }) => (
  <a
    href={buildEtherscanLink(`/address/${address}`)}
    target="_blank"
    rel="norefferer"
    {...props}
  />
);

export default ChainExplorerAddressLink;
