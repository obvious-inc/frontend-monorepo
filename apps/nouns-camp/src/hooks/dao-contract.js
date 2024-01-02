import va from "@vercel/analytics";
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

export const useActiveProposalId = (accountAddress) => {
  const latestProposalId = useLatestProposalId(accountAddress);
  const state = useProposalState(latestProposalId);

  if (latestProposalId === undefined || state === undefined) return undefined;

  const isActive = [
    "updatable",
    "pending",
    "active",
    "objection-period",
  ].includes(state);

  return isActive ? latestProposalId : null;
};

export const useCanCreateProposal = () => {
  const { address: connectedAccountAddress } = useWallet();

  const numberOfVotes = useCurrentVotes(connectedAccountAddress);

  const proposalThreshold = useProposalThreshold();

  const hasActiveProposal =
    useActiveProposalId(connectedAccountAddress) != null;

  if (hasActiveProposal == null || proposalThreshold == null) return null;

  if (hasActiveProposal) return false;

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
    va.track("Vote", {
      proposalId,
      account: accountAddress,
    });
    return write().then(({ hash }) => {
      va.track("Vote successfully cast", {
        proposalId,
        hash,
        account: accountAddress,
      });
      const voterId = accountAddress.toLowerCase();
      addOptimitisicProposalVote(proposalId, {
        id: String(Math.random()),
        reason,
        support,
        createdBlock: blockNumber,
        voterId,
        voter: { id: voterId },
      });
      return { hash };
    });
  };
};

export const useCreateProposal = () => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
    ]),
    functionName: "propose",
  });

  return async ({ description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [targets, values, signatures, calldatas, description],
    })
      .then(({ hash }) => {
        va.track("Proposal successfully created", {
          account: accountAddress,
          hash,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
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

export const useCreateProposalWithSignatures = () => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function proposeBySigs((bytes sig, address signer, uint256 expirationTimestamp)[], address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
    ]),
    functionName: "proposeBySigs",
  });

  return async ({ description, transactions, proposerSignatures }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [
        proposerSignatures,
        targets,
        values,
        signatures,
        calldatas,
        description,
      ],
    })
      .then(({ hash }) => {
        va.track("Proposal successfully created", {
          account: accountAddress,
          hash,
          signatures: true,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
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

export const useUpdateProposal = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const chainId = useChainId();

  const contractAddress = getContractAddress(chainId);

  const { writeAsync: updateProposal } = useContractWrite({
    address: contractAddress,
    abi: parseAbi([
      "function updateProposal(uint256 proposalId, address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string updateMessage) external",
    ]),
    functionName: "updateProposal",
  });

  const { writeAsync: updateProposalDescription } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateProposalDescription(uint256 proposalId, string memory description, string updateMessage) external",
    ]),
    functionName: "updateProposalDescription",
  });

  const { writeAsync: updateProposalTransactions } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateProposalTransactions(uint256 proposalId, address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string updateMessage) external",
    ]),
    functionName: "updateProposalTransactions",
  });

  return async ({ description, transactions, updateMessage }) => {
    const write = () => {
      if (transactions == null)
        return updateProposalDescription({
          args: [proposalId, description, updateMessage],
        });

      const { targets, values, signatures, calldatas } = unparseTransactions(
        transactions,
        { chainId }
      );

      if (description == null)
        return updateProposalTransactions({
          args: [
            proposalId,
            targets,
            values,
            signatures,
            calldatas,
            updateMessage,
          ],
        });

      return updateProposal({
        args: [
          proposalId,
          targets,
          values,
          signatures,
          calldatas,
          description,
          updateMessage,
        ],
      });
    };

    return write().then(({ hash }) => {
      va.track("Proposal successfully updated", {
        proposalId,
        account: accountAddress,
        hash,
      });
      return { hash };
    });
  };
};

export const useCancelProposal = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi(["function cancel(uint256 proposalId) external"]),
    functionName: "cancel",
    args: [proposalId],
  });
  const { writeAsync: write } = useContractWrite(config);

  if (write == null) return null;

  return () =>
    write().then(({ hash }) => {
      va.track("Proposal successfully canceled", {
        account: accountAddress,
        hash,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

export const useCancelSignature = (signature) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi(["function cancelSig(bytes calldata sig) external"]),
    functionName: "cancelSig",
    args: [signature],
  });

  const { writeAsync: write } = useContractWrite(config);

  if (write == null) return null;

  return () =>
    write().then(({ hash }) =>
      publicClient.waitForTransactionReceipt({ hash })
    );
};
