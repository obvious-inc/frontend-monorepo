import {
  getAddress as checksumEncodeAddress,
  isAddress as isEthereumAccountAddress,
} from "viem";
import { useEnsName } from "wagmi";
import { useUserWithWalletAddress } from "./user.js";
import { truncateAddress } from "../utils/ethereum.js";

const useAccountDisplayName = (
  walletAddress,
  { customDisplayName = true } = {}
) => {
  const user = useUserWithWalletAddress(walletAddress);

  const { data: ensName } = useEnsName({
    address: walletAddress,
    enabled: user == null && walletAddress != null && customDisplayName,
  });

  const isAddress = isEthereumAccountAddress(walletAddress);

  if (walletAddress != null && !isAddress)
    console.warn(`Invalid address "${walletAddress}`);

  const names = { ensName, userDisplayName: user?.displayName };

  if (!customDisplayName) {
    const displayName =
      ensName ??
      (isAddress
        ? truncateAddress(checksumEncodeAddress(walletAddress))
        : null);
    return { displayName, ...names };
  }

  const displayName =
    user?.displayName ??
    ensName ??
    (isAddress ? truncateAddress(checksumEncodeAddress(walletAddress)) : null);

  return { displayName, ...names };
};

export default useAccountDisplayName;
