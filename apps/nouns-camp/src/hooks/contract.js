import { resolveIdentifier, resolveAddress } from "@/contracts";

const useContract = (identifierOrAddress) => {
  return (
    resolveIdentifier(identifierOrAddress) ??
    resolveAddress(identifierOrAddress)
  );
};

export default useContract;
