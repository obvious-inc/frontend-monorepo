import { decodeEventLog } from "viem";
import React from "react";
import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  usePublicClient,
  useBlockNumber,
} from "wagmi";
import { unparse as unparseTransactions } from "../utils/transactions.js";
import { resolveIdentifier } from "../contracts.js";
import { useActions } from "../store.js";
import { useWallet } from "./wallet.js";
import useChainId from "./chain-id.js";
import useRegisterEvent from "./register-event.js";
import { useCurrentVotes } from "./token-contract.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "dao").address;

export const useProposalThreshold = () => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [],
        name: "proposalThreshold",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "proposalThreshold",
  });

  return data == null ? null : Number(data);
};

const useLatestProposalId = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "address" }],
        name: "latestProposalIds",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "latestProposalIds",
    args: [accountAddress],
    query: {
      enabled: accountAddress != null,
    },
  });

  if (!isSuccess) return undefined;

  return data == null ? null : Number(data);
};

export const useDynamicQuorum = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "uint256" }],
        name: "quorumVotes",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
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

  const { data: adjustedTotalSupply } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [],
        name: "adjustedTotalSupply",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "adjustedTotalSupply",
  });
  const { data: quorumParams } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "uint256" }],
        name: "getDynamicQuorumParamsAt",
        outputs: [{ type: "uint16" }, { type: "uint16" }, { type: "uint32" }],
        type: "function",
      },
    ],
    functionName: "getDynamicQuorumParamsAt",
    args: [blockNumber],
    query: {
      enabled: blockNumber != null,
    },
  });

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [
          { type: "uint256" },
          { type: "uint256" },
          {
            components: [
              { type: "uint16" },
              { type: "uint16" },
              { type: "uint32" },
            ],
            type: "tuple",
          },
        ],
        name: "dynamicQuorumVotes",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "dynamicQuorumVotes",
    args: [againstVotes, adjustedTotalSupply, quorumParams],
    query: {
      enabled: adjustedTotalSupply != null && quorumParams != null,
    },
  });

  React.useEffect(() => {
    if (isSuccess) latestQuorumRef.current = Number(data);
  });

  if (!isSuccess) return latestQuorumRef.current;

  return Number(data);
};

const useProposalState = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "uint256" }],
        name: "state",
        outputs: [{ type: "uint8" }],
        type: "function",
      },
    ],
    functionName: "state",
    args: [proposalId],
    query: {
      enabled: proposalId != null,
    },
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
  { support, reason, enabled = true },
) => {
  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber();
  const { address: accountAddress } = useWallet();
  const { addOptimitisicProposalVote } = useActions();
  const registerEvent = useRegisterEvent();

  const hasReason = reason != null && reason.trim() !== "";

  const {
    data: castVoteSimulationResult,
    isSuccess: castVoteSimulationSuccessful,
    error: castVoteSimulationError,
  } = useSimulateContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "uint256" }, { type: "uint8" }],
        name: "castRefundableVote",
        outputs: [],
        type: "function",
      },
    ],
    functionName: "castRefundableVote",
    args: [Number(proposalId), support],
    query: {
      enabled: enabled && support != null && !hasReason,
    },
  });

  const {
    data: castVoteWithReasonSimulationResult,
    isSuccess: castVoteWithReasonSimulationSuccessful,
    error: castVoteWithReasonSimulationError,
  } = useSimulateContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [{ type: "uint256" }, { type: "uint8" }, { type: "string" }],
        name: "castRefundableVoteWithReason",
        outputs: [],
        type: "function",
      },
    ],
    functionName: "castRefundableVoteWithReason",
    args: [Number(proposalId), support, reason],
    query: {
      enabled: enabled && support != null && hasReason,
    },
  });

  const simulationError =
    castVoteSimulationError || castVoteWithReasonSimulationError;

  const { writeContractAsync: writeContract } = useWriteContract();

  if (simulationError != null)
    console.warn("Unexpected simulation error", simulationError);

  if (hasReason && !castVoteWithReasonSimulationSuccessful) return null;
  if (!hasReason && !castVoteSimulationSuccessful) return null;

  return async () =>
    writeContract(
      hasReason
        ? castVoteWithReasonSimulationResult.request
        : castVoteSimulationResult.request,
    ).then((hash) => {
      const voterId = accountAddress.toLowerCase();

      addOptimitisicProposalVote(proposalId, {
        id: String(Math.random()),
        reason,
        support,
        createdBlock: blockNumber,
        voterId,
        voter: { id: voterId },
      });

      registerEvent("Vote successfully cast", {
        proposalId,
        hash,
        account: accountAddress,
      });

      return hash;
    });
};

export const useCreateProposal = () => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [
            { name: "targets", type: "address[]" },
            { name: "values", type: "uint256[]" },
            { name: "signatures", type: "string[]" },
            { name: "calldatas", type: "bytes[]" },
            { name: "description", type: "string" },
          ],
          name: "propose",
          outputs: [{ type: "uint256" }],
          type: "function",
        },
      ],
      functionName: "propose",
      args: [targets, values, signatures, calldatas, description],
    })
      .then((hash) => {
        registerEvent("Proposal successfully created", {
          account: accountAddress,
          hash,
        });

        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[1];
        const decodedEvent = decodeEventLog({
          abi: [
            {
              inputs: [
                { name: "id", type: "uint256" },
                { name: "proposer", type: "address" },
                { name: "signers", type: "address[]" },
                { name: "targets", type: "address[]" },
                { name: "values", type: "uint256[]" },
                { name: "signatures", type: "string[]" },
                { name: "calldatas", type: "bytes[]" },
                { name: "startBlock", type: "uint256" },
                { name: "endBlock", type: "uint256" },
                { name: "updatePeriodEndBlock", type: "uint256" },
                { name: "proposalThreshold", type: "uint256" },
                { name: "quorumVotes", type: "uint256" },
                { name: "description", type: "string" },
              ],
              name: "ProposalCreatedWithRequirements",
              type: "event",
            },
          ],
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
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions, proposerSignatures }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [
            {
              components: [
                { name: "sig", type: "bytes" },
                { name: "signer", type: "address" },
                { name: "expirationTimestamp", type: "uint256" },
              ],
              name: "proposerSignatures",
              type: "tuple[]",
            },
            { name: "targets", type: "address[]" },
            { name: "values", type: "uint256[]" },
            { name: "signatures", type: "string[]" },
            { name: "calldatas", type: "bytes[]" },
            { name: "description", type: "string" },
          ],
          name: "proposeBySigs",
          outputs: [{ type: "uint256" }],
          type: "function",
        },
      ],
      functionName: "proposeBySigs",
      args: [
        proposerSignatures,
        targets,
        values,
        signatures,
        calldatas,
        description,
      ],
    })
      .then((hash) => {
        registerEvent("Proposal successfully created", {
          account: accountAddress,
          hash,
          signatures: true,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[1];
        const decodedEvent = decodeEventLog({
          abi: [
            {
              inputs: [
                { name: "id", type: "uint256" },
                { name: "proposer", type: "address" },
                { name: "signers", type: "address[]" },
                { name: "targets", type: "address[]" },
                { name: "values", type: "uint256[]" },
                { name: "signatures", type: "string[]" },
                { name: "calldatas", type: "bytes[]" },
                { name: "startBlock", type: "uint256" },
                { name: "endBlock", type: "uint256" },
                { name: "updatePeriodEndBlock", type: "uint256" },
                { name: "proposalThreshold", type: "uint256" },
                { name: "quorumVotes", type: "uint256" },
                { name: "description", type: "string" },
              ],
              name: "ProposalCreatedWithRequirements",
              type: "event",
            },
          ],
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useUpdateSponsoredProposalWithSignatures = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({
    description,
    transactions,
    proposerSignatures,
    updateMessage,
  }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [
            { name: "proposalId", type: "uint256" },
            {
              components: [
                { name: "sig", type: "bytes" },
                { name: "signer", type: "address" },
                { name: "expirationTimestamp", type: "uint256" },
              ],
              name: "proposerSignatures",
              type: "tuple[]",
            },
            { name: "targets", type: "address[]" },
            { name: "values", type: "uint256[]" },
            { name: "signatures", type: "string[]" },
            { name: "calldatas", type: "bytes[]" },
            { name: "description", type: "string" },
            { name: "updateMessage", type: "string" },
          ],
          name: "updateProposalBySigs",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "updateProposalBySigs",
      args: [
        proposalId,
        proposerSignatures,
        targets,
        values,
        signatures,
        calldatas,
        description,
        updateMessage,
      ],
    }).then((hash) => {
      registerEvent("Proposal successfully updated", {
        account: accountAddress,
        hash,
        signatures: true,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
  };
};

export const useUpdateProposal = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const contractAddress = getContractAddress(chainId);

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions, updateMessage }) => {
    const write = () => {
      if (transactions == null)
        return writeContract({
          address: getContractAddress(chainId),
          abi: [
            {
              inputs: [
                { name: "proposalId", type: "uint256" },
                { name: "description", type: "string" },
                { name: "updateMessage", type: "string" },
              ],
              name: "updateProposalDescription",
              outputs: [],
              type: "function",
            },
          ],
          functionName: "updateProposalDescription",
          args: [proposalId, description, updateMessage],
        });

      const { targets, values, signatures, calldatas } = unparseTransactions(
        transactions,
        { chainId },
      );

      if (description == null)
        return writeContract({
          address: getContractAddress(chainId),
          abi: [
            {
              inputs: [
                { name: "proposalId", type: "uint256" },
                { name: "targets", type: "address[]" },
                { name: "values", type: "uint256[]" },
                { name: "signatures", type: "string[]" },
                { name: "calldatas", type: "bytes[]" },
                { name: "updateMessage", type: "string" },
              ],
              name: "updateProposalTransactions",
              outputs: [],
              type: "function",
            },
          ],
          functionName: "updateProposalTransactions",
          args: [
            proposalId,
            targets,
            values,
            signatures,
            calldatas,
            updateMessage,
          ],
        });

      return writeContract({
        address: contractAddress,
        abi: [
          {
            inputs: [
              { name: "proposalId", type: "uint256" },
              { name: "targets", type: "address[]" },
              { name: "values", type: "uint256[]" },
              { name: "signatures", type: "string[]" },
              { name: "calldatas", type: "bytes[]" },
              { name: "description", type: "string" },
              { name: "updateMessage", type: "string" },
            ],
            name: "updateProposal",
            outputs: [],
            type: "function",
          },
        ],
        functionName: "updateProposal",
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

    return write().then((hash) => {
      registerEvent("Proposal successfully updated", {
        proposalId,
        account: accountAddress,
        hash,
      });
      return hash;
    });
  };
};

export const useCancelProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "uint256" }],
          name: "cancel",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "cancel",
      args: [proposalId],
      query: {
        enabled,
      },
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContract(simulationResult.request);
    registerEvent("Proposal successfully canceled", {
      account: accountAddress,
      hash,
    });
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

export const useQueueProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "uint256" }],
          name: "queue",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "queue",
      args: [proposalId],
      query: {
        enabled,
      },
    });
  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Proposal successfully queued", {
        account: accountAddress,
        hash,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

export const useExecuteProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "uint256" }],
          name: "execute",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "execute",
      args: [proposalId],
      query: {
        enabled,
      },
    });
  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Proposal successfully executed", {
        account: accountAddress,
        hash,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

export const useCancelSignature = (signature) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "bytes" }],
          name: "cancelSig",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "cancelSig",
      args: [signature],
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) =>
      publicClient.waitForTransactionReceipt({ hash }),
    );
};
