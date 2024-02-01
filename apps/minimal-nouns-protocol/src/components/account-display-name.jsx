import { useEnsName } from "wagmi";

const AccountDisplayName = ({ address }) => {
  const { data: ensName } = useEnsName({ address });
  return ensName ?? [address.slice(0, 6), address.slice(-4)].join("...");
};

export default AccountDisplayName;
