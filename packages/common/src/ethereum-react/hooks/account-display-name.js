import {
  getAddress as checksumEncodeAddress,
  isAddress as isEthereumAccountAddress,
} from "viem";
import { useEnsName } from "wagmi";
import { truncateAddress } from "../../utils/ethereum.js";

const useAccountDisplayName = (accountAddress) => {
  const isAddress =
    accountAddress != null && isEthereumAccountAddress(accountAddress);

  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: isAddress,
  });

  const truncatedAddress = isAddress
    ? truncateAddress(checksumEncodeAddress(accountAddress))
    : null;

  if (accountAddress != null && !isAddress)
    console.warn(`Invalid address "${accountAddress}"`);

  return ensName ?? truncatedAddress;
};

export default useAccountDisplayName;
