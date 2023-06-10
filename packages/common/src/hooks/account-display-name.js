import {
  getAddress as checksumEncodeAddress,
  isAddress as isEthereumAccountAddress,
} from "viem";
import { useEnsName } from "wagmi";
import { useUserWithWalletAddress } from "./user.js";
import { truncateAddress } from "../utils/ethereum.js";

const useAccountDisplayName = (
  accountAddress,
  { customDisplayName = true } = {}
) => {
  const user = useUserWithWalletAddress(accountAddress);

  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: user == null && accountAddress != null && customDisplayName,
  });

  const isAddress = isEthereumAccountAddress(accountAddress);

  if (accountAddress != null && !isAddress)
    console.warn(`Invalid address "${accountAddress}`);

  const checksumEncodedAddress = isAddress
    ? checksumEncodeAddress(accountAddress)
    : null;

  const truncatedAddress =
    checksumEncodedAddress != null
      ? truncateAddress(checksumEncodedAddress)
      : null;

  const names = {
    address: checksumEncodedAddress,
    truncatedAddress,
    ensName,
    userDisplayName: user?.displayName,
  };

  if (!customDisplayName) {
    const displayName = ensName ?? truncatedAddress;
    return { displayName, ...names };
  }

  const primaryName = user?.displayName ?? ensName ?? truncatedAddress;

  return { displayName: primaryName, ...names };
};

export default useAccountDisplayName;
