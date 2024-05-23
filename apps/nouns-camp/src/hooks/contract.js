import useChainId from "./chain-id.js";
import { resolveIdentifier, resolveAddress } from "../contracts.js";

const useContract = (identifierOrAddress) => {
  const chainId = useChainId();
  return (
    resolveIdentifier(chainId, identifierOrAddress) ??
    resolveAddress(chainId, identifierOrAddress)
  );
};

export default useContract;
