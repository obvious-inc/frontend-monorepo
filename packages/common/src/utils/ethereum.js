import { utils as ethersUtils } from "ethers";

export const truncateAddress = (address_) => {
  const address = ethersUtils.getAddress(address_);
  return [address.slice(0, 6), address.slice(-4)].join("...");
};
