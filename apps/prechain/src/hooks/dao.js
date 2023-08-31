import React from "react";
import { parseAbi, decodeEventLog } from "viem";
import { array as arrayUtils } from "@shades/common/utils";
import { useFetch, useLatestCallback } from "@shades/common/react";

const { sortBy } = arrayUtils;

import {
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  usePublicClient,
  useBlockNumber,
} from "wagmi";
import { useWallet } from "./wallet.js";
import {
  ChainDataCacheContext,
  contractAddressesByChainId,
  useChainId,
} from "./prechain.js";

const EXECUTION_GRACE_PERIOD_IN_MILLIS = 1000 * 60 * 60 * 24 * 21; // 21 days

export const useProposalFetch = (id, options) => {
  const onError = useLatestCallback(options?.onError);

  const {
    actions: { fetchProposal },
  } = React.useContext(ChainDataCacheContext);

  useFetch(
    () =>
      fetchProposal(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchProposal, id, onError]
  );
};

export const useProposals = () => {
  const { data: blockNumber } = useBlockNumber();

  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(
    () =>
      sortBy(
        (p) => p.lastUpdatedTimestamp,
        Object.values(proposalsById).map((p) => ({
          ...p,
          state:
            blockNumber == null ? null : getProposalState(p, { blockNumber }),
        }))
      ),
    [proposalsById, blockNumber]
  );
};

export const useProposal = (id) => {
  const { data: blockNumber } = useBlockNumber();

  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);

  const proposal = proposalsById[id];

  return React.useMemo(() => {
    if (proposal == null) return null;
    if (blockNumber == null) return proposal;

    return {
      ...proposal,
      state: getProposalState(proposal, { blockNumber }),
    };
  }, [proposal, blockNumber]);
};

export const useProposalThreshold = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chainId].dao,
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
    address: contractAddressesByChainId[chainId].dao,
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

const useCurrentVotes = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useContractRead({
    address: contractAddressesByChainId[chainId].token,
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

export const useCanCreateProposal = () => {
  const { address: connectedAccountAddress } = useWallet();

  const numberOfVotes = useCurrentVotes(connectedAccountAddress);

  const proposalThreshold = useProposalThreshold();

  const latestProposalId = useLatestProposalId(connectedAccountAddress);
  const latestProposal = useProposal(latestProposalId);

  if (latestProposalId === undefined) return null;

  const hasActiveProposal =
    latestProposal != null &&
    ["updatable", "pending", "active", "objection-period"].includes(
      latestProposal.state
    );

  if (hasActiveProposal) return false;

  if (proposalThreshold == null) return null;

  const hasEnoughVotes = numberOfVotes > proposalThreshold;

  return hasEnoughVotes;
};

const isPropsalDefeated = (proposal) =>
  Number(proposal.forVotes) <= Number(proposal.againstVotes) ||
  Number(proposal.forVotes) < Number(proposal.quorumVotes);

const getProposalState = (proposal, { blockNumber }) => {
  if (proposal.status === "VETOED") return "vetoed";
  if (proposal.status === "CANCELLED") return "canceled";
  if (proposal.status === "EXECUTED") return "executed";

  if (blockNumber <= proposal.updatePeriodEndBlock) return "updatable";
  if (blockNumber <= proposal.startBlock) return "pending";
  if (blockNumber <= proposal.endBlock) return "active";
  if (blockNumber <= proposal.objectionPeriodEndBlock)
    return "objection-period";

  if (isPropsalDefeated(proposal)) return "defeated";

  if (proposal.executionETA === null) return "succeeded"; // Not yet queued

  if (
    new Date().getTime() >=
    Number(proposal.executionETA) * 1000 + EXECUTION_GRACE_PERIOD_IN_MILLIS
  )
    return "expired";

  return "queued";
};

export const isFinalProposalState = (state) =>
  ["vetoed", "canceled", "defeated", "executed", "expired"].includes(state);

export const isSucceededProposalState = (state) =>
  ["succeeded", "queued", "executed"].includes(state);

export const isVotableProposalState = (state) =>
  ["active", "objection-period"].includes(state);

export const useCastProposalVote = (
  proposalId,
  { support, reason, enabled = true }
) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const hasReason = reason != null && reason.trim() !== "";

  const { config: castVoteConfig } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].dao,
    abi: parseAbi([
      "function castRefundableVote(uint256 proposalId, uint8 support) external",
    ]),
    functionName: "castRefundableVote",
    args: [Number(proposalId), support],
    enabled: enabled && !hasReason,
  });

  const { config: castVoteWithReasonConfig } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].dao,
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

  if (write == null) return null;

  return () =>
    write().then(({ hash }) =>
      publicClient.waitForTransactionReceipt({ hash })
    );
};

export const useSendProposalFeedback = (proposalId, { support, reason }) => {
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function sendFeedback(uint256 proposalId, uint8 support, string memory reason) external",
    ]),
    functionName: "sendFeedback",
    args: [parseInt(proposalId), support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write;
};

export const useCreateProposal = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: contractAddressesByChainId[chainId].dao,
    abi: parseAbi([
      "function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
    ]),
    functionName: "propose",
    enabled,
  });

  return ({
    description,
    // Target addresses
    targets = ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
    // Values
    values = ["0"],
    // Function signatures
    signatures = [""],
    // Calldatas
    calldatas = ["0x"],
  }) =>
    writeAsync({
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

export const useCancelProposal = (proposalId) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].dao,
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
