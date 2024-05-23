import { resolveIdentifier, resolveAddress } from "../contracts.js";

const useContract = (identifierOrAddress) => {
  return (
    resolveIdentifier(identifierOrAddress) ??
    resolveAddress(identifierOrAddress)
  );
};

export default useContract;
