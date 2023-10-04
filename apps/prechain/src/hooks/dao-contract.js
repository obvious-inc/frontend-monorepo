import { parseAbi, decodeEventLog } from "viem";
import {
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  usePublicClient,
} from "wagmi";
import { unparse as unparseTransactions } from "../utils/transactions.js";
import { resolveIdentifier } from "../contracts.js";
import { useWallet } from "./wallet.js";
import useChainId from "./chain-id.js";
import { useCurrentVotes } from "./token-contract.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "dao").address;

export const useProposalThreshold = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function proposalThreshold() public view returns (uint256)",
    ]),
    functionName: "proposalThreshold",
  });

  return data == null ? null : Number(data);
};

const useLatestProposalId = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function latestProposalIds(address account) public view returns (uint256)",
    ]),
    functionName: "latestProposalIds",
    args: [accountAddress],
    enabled: accountAddress != null,
  });

  if (!isSuccess) return undefined;

  return data == null ? null : Number(data);
};

export const useDynamicQuorum = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function quorumVotes(uint256 proposalId) public view returns (uint256)",
    ]),
    functionName: "quorumVotes",
    args: [proposalId],
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

const useProposalState = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function state(uint256 proposalId) external view returns (uint8)",
    ]),
    functionName: "state",
    args: [proposalId],
    enabled: proposalId != null,
  });

  if (!isSuccess) return undefined;

  return [
    "pending",
    "active",
    "canceled",
    "defeated",
    "succeeded",
    "queued",
    "expired",
    "executed",
    "vetoed",
    "objection-period",
    "updatable",
  ][Number(data)];
};

export const useCanCreateProposal = () => {
  const { address: connectedAccountAddress } = useWallet();

  const numberOfVotes = useCurrentVotes(connectedAccountAddress);

  const proposalThreshold = useProposalThreshold();

  const latestProposalId = useLatestProposalId(connectedAccountAddress);
  const latestProposalState = useProposalState(latestProposalId);

  if (latestProposalState === undefined) return null;

  const hasActiveProposal = [
    "updatable",
    "pending",
    "active",
    "objection-period",
  ].includes(latestProposalState);

  if (hasActiveProposal) return false;

  if (proposalThreshold == null) return null;

  const hasEnoughVotes = numberOfVotes > proposalThreshold;

  return hasEnoughVotes;
};

export const useCastProposalVote = (
  proposalId,
  { support, reason, enabled = true }
) => {
  const chainId = useChainId();

  const hasReason = reason != null && reason.trim() !== "";

  const { config: castVoteConfig } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVote(uint256 proposalId, uint8 support) external",
    ]),
    functionName: "castRefundableVote",
    args: [Number(proposalId), support],
    enabled: enabled && !hasReason,
  });

  const { config: castVoteWithReasonConfig } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external",
    ]),
    functionName: "castRefundableVoteWithReason",
    args: [Number(proposalId), support, reason],
    enabled: enabled && hasReason,
  });

  const { writeAsync: writeCastVote } = useContractWrite(castVoteConfig);
  const { writeAsync: writeCastVoteWithReason } = useContractWrite(
    castVoteWithReasonConfig
  );

  const write = hasReason ? writeCastVoteWithReason : writeCastVote;

  return write;
};

export const useCreateProposal = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
    ]),
    functionName: "propose",
    enabled,
  });

  return async ({ description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [targets, values, signatures, calldatas, description],
    })
      .then(({ hash }) => publicClient.waitForTransactionReceipt({ hash }))
      .then((receipt) => {
        const eventLog = receipt.logs[1];
        const decodedEvent = decodeEventLog({
          abi: parseAbi([
            "event ProposalCreatedWithRequirements(uint256 id, address proposer, address[] signers, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, uint256 updatePeriodEndBlock, uint256 proposalThreshold, uint256 quorumVotes, string description)",
          ]),
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useCancelProposal = (proposalId) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi(["function cancel(uint256 proposalId) external"]),
    functionName: "cancel",
    args: [proposalId],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write == null
    ? null
    : () =>
        write().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};