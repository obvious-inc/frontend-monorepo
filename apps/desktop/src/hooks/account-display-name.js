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

  const names = { ensName, userDisplayName: user?.displayName };

  if (!customDisplayName) {
    const displayName =
      ensName ??
      (isAddress
        ? truncateAddress(ethersUtils.getAddress(walletAddress))
        : null);
    return { displayName, ...names };
  }

  const displayName =
    user?.displayName ??
    ensName ??
    (isAddress ? truncateAddress(ethersUtils.getAddress(walletAddress)) : null);

  return { displayName, ...names };
};

export default useAccountDisplayName;
