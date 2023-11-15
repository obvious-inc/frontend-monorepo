import { parseAbi } from "viem";
import { useContractRead } from "wagmi";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "./chain-id.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "token").address;

export const useCurrentVotes = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getCurrentVotes(address account) external view returns (uint96)",
    ]),
    functionName: "getCurrentVotes",
    args: [accountAddress],
    enabled: accountAddress != null,
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const usePriorVotes = ({ account, blockNumber, enabled = true }) => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getPriorVotes(address account, uint256 block) public view returns (uint256)",
    ]),
    functionName: "getPriorVotes",
    args: [account, blockNumber],
    enabled: enabled && account != null && blockNumber != null,
  });

  return data == null ? null : Number(data);
};
