import { utils as ethersUtils } from "ethers";
import { useEnsName } from "wagmi";
import { useUserWithWalletAddress } from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";

const { truncateAddress } = ethereumUtils;

const useAccountDisplayName = (
  walletAddress,
  { customDisplayName = true } = {}
) => {
  const user = useUserWithWalletAddress(walletAddress);

  const { data: ensName } = useEnsName({
    address: walletAddress,
    enabled: user == null && walletAddress != null && customDisplayName,
  });

  const isAddress = ethersUtils.isAddress(walletAddress);

  if (walletAddress != null && !isAddress)
    console.warn(`Invalid address "${walletAddress}`);

  if (!customDisplayName) {
    if (ensName != null) return ensName;
    return isAddress
      ? truncateAddress(ethersUtils.getAddress(walletAddress))
      : null;
  }

  const displayName =
    user?.displayName ??
    ensName ??
    (isAddress ? truncateAddress(ethersUtils.getAddress(walletAddress)) : null);

  return displayName;
};

export default useAccountDisplayName;
