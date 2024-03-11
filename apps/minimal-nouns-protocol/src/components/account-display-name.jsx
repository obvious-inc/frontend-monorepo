import { getAddress } from "viem";
import { useEnsName } from "wagmi";

const AccountDisplayName = ({ address }) => {
  const { data: ensName } = useEnsName({ address });

  if (ensName != null) return ensName;

  const checksumAddress = getAddress(address);

  return [checksumAddress.slice(0, 6), checksumAddress.slice(-4)].join("...");
};

export default AccountDisplayName;
