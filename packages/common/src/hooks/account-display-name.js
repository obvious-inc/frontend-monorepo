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

  const { data: wagmiEnsName } = useEnsName({
    address: accountAddress,
    enabled:
      user?.ensName == null &&
      accountAddress != null &&
      isEthereumAccountAddress(accountAddress),
  });

  const ensName = wagmiEnsName ?? user?.ensName;

  const isAddress = isEthereumAccountAddress(accountAddress);

  if (accountAddress != null && !isAddress)
    console.warn(`Invalid address "${accountAddress}"`);

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
