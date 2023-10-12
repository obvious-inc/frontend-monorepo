import { parseAbi, decodeEventLog } from "viem";
import React from "react";
import {
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  usePublicClient,
  useBlockNumber,
} from "wagmi";
import { unparse as unparseTransactions } from "../utils/transactions.js";
import { resolveIdentifier } from "../contracts.js";
import { useActions } from "../store.js";
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

export const useCurrentDynamicQuorum = ({ againstVotes = 0 } = {}) => {
  const latestQuorumRef = React.useRef();

  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber({ watch: true, cache: 20_000 });

  const { data: adjustedTotalSupply } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function adjustedTotalSupply() public view returns (uint256)",
    ]),
    functionName: "adjustedTotalSupply",
  });
  const { data: quorumParams } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getDynamicQuorumParamsAt(uint256) public view returns (uint16, uint16, uint32)",
    ]),
    functionName: "getDynamicQuorumParamsAt",
    args: [blockNumber],
    enabled: blockNumber != null,
  });
  const { data, isSuccess } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function dynamicQuorumVotes(uint256, uint256, (uint16, uint16, uint32)) public view returns (uint256)",
    ]),
    functionName: "dynamicQuorumVotes",
    args: [againstVotes, adjustedTotalSupply, quorumParams],
    encoded: adjustedTotalSupply != null && quorumParams != null,
  });

  React.useEffect(() => {
    if (isSuccess) latestQuorumRef.current = Number(data);
  });

  if (!isSuccess) return latestQuorumRef.current;

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
  const { data: blockNumber } = useBlockNumber();
  const { address: accountAddress } = useWallet();
  const { addOptimitisicProposalVote } = useActions();

  const hasReason = reason != null && reason.trim() !== "";

  const { config: castVoteConfig } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVote(uint256 proposalId, uint8 support) external",
    ]),
    functionName: "castRefundableVote",
    args: [Number(proposalId), support],
    enabled: enabled && support != null && !hasReason,
  });

  const { config: castVoteWithReasonConfig } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external",
    ]),
    functionName: "castRefundableVoteWithReason",
    args: [Number(proposalId), support, reason],
    enabled: enabled && support != null && hasReason,
  });

  const { writeAsync: writeCastVote } = useContractWrite(castVoteConfig);
  const { writeAsync: writeCastVoteWithReason } = useContractWrite(
    castVoteWithReasonConfig
  );

  const write = hasReason ? writeCastVoteWithReason : writeCastVote;

  if (write == null) return null;

  return async () => {
    return write().then(({ hash }) => {
      addOptimitisicProposalVote(proposalId, {
        id: String(Math.random()),
        reason,
        supportDetailed: support,
        blockNumber,
        voter: { id: accountAddress.toLowerCase() },
      });
      return { hash };
    });
  };
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
