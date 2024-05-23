import { isAddress as isEthereumAccountAddress } from "viem";
import { useEnsName } from "wagmi";
import { truncateAddress } from "../../utils/ethereum.js";

const useAccountDisplayName = (accountAddress, { enabled = true } = {}) => {
  const isAddress =
    accountAddress != null && isEthereumAccountAddress(accountAddress);

  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: enabled && isAddress,
  });

  const truncatedAddress = isAddress ? truncateAddress(accountAddress) : null;

  if (accountAddress != null && !isAddress)
    console.warn(`Invalid address "${accountAddress}"`);

  return ensName ?? truncatedAddress;
};

export default useAccountDisplayName;
