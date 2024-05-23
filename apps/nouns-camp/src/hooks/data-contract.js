import {
  stringToBytes,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  decodeEventLog,
} from "viem";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useSignTypedData,
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
  resolveIdentifier(chainId, "data").address;

export const useSendProposalCandidateFeedback = (
  proposerId,
  slug,
  { support, reason },
) => {
  const { address: accountAddress } = useWallet();
  const { data: blockNumber } = useBlockNumber();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { addOptimitisicCandidateFeedbackPost } = useActions();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [
            { name: "proposer", type: "address" },
            { name: "slug", type: "string" },
            { name: "support", type: "uint8" },
            { name: "reason", type: "string" },
          ],
          name: "sendCandidateFeedback",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "sendCandidateFeedback",
      args: [proposerId, slug, support, reason],
      query: {
        enabled: support != null,
      },
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return async () => {
    const candidateId = [proposerId, slug].join("-").toLowerCase();
    const voterId = accountAddress.toLowerCase();
    return writeContract(simulationResult.request).then((hash) => {
      registerEvent("Candidate feedback successfully submitted", {
        candidateId,
        hash,
        account: accountAddress,
      });
      addOptimitisicCandidateFeedbackPost(candidateId, {
        id: String(Math.random()),
        reason,
        support,
        createdTimestamp: new Date(),
        createdBlock: blockNumber,
        voterId,
        voter: { id: voterId },
      });
      return hash;
    });
  };
};

export const useSendProposalFeedback = (proposalId, { support, reason }) => {
  const { address: accountAddress } = useWallet();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "uint256" }, { type: "uint8" }, { type: "string" }],
          name: "sendFeedback",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "sendFeedback",
      args: [parseInt(proposalId), support, reason],
      query: {
        enabled: support != null,
      },
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return async () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Proposal feedback successfully submitted", {
        proposalId,
        hash,
        account: accountAddress,
      });
      return hash;
    });
};

export const useCreateProposalCandidate = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { address: accountAddress } = useWallet();
  const votingPower = useCurrentVotes(accountAddress);

  const createCost = useProposalCandidateCreateCost({ enabled });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (votingPower == null || createCost == null) return null;

  return async ({ slug, description, transactions, targetProposalId = 0 }) => {
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
            { name: "slug", type: "string" },
            { name: "proposalIdToUpdate", type: "uint256" },
          ],
          name: "createProposalCandidate",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "createProposalCandidate",
      value: votingPower > 0 ? 0 : createCost,
      args: [
        targets,
        values,
        signatures,
        calldatas,
        description,
        slug,
        targetProposalId,
      ],
    })
      .then((hash) => {
        registerEvent("Candidate successfully created", {
          hash,
          slug,
          account: accountAddress,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[0];
        const decodedEvent = decodeEventLog({
          abi: [
            {
              inputs: [
                { indexed: true, name: "msgSender", type: "address" },
                { name: "targets", type: "address[]" },
                { name: "values", type: "uint256[]" },
                { name: "signatures", type: "string[]" },
                { name: "calldatas", type: "bytes[]" },
                { name: "description", type: "string" },
                { name: "slug", type: "string" },
                { name: "proposalIdToUpdate", type: "uint256" },
                { name: "encodedProposalHash", type: "bytes32" },
              ],
              name: "ProposalCandidateCreated",
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

export const useProposalCandidateCreateCost = ({ enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [],
        name: "createCandidateCost",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "createCandidateCost",
    query: {
      enabled,
    },
  });

  return data;
};

export const useProposalCandidateUpdateCost = ({ enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: [
      {
        inputs: [],
        name: "updateCandidateCost",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "updateCandidateCost",
    query: {
      enabled,
    },
  });

  return data;
};

export const useUpdateProposalCandidate = (slug, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const updateCost = useProposalCandidateUpdateCost({ enabled });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (updateCost == null) return null;

  return async ({
    description,
    transactions,
    targetProposalId = 0,
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
            { name: "targets", type: "address[]" },
            { name: "values", type: "uint256[]" },
            { name: "signatures", type: "string[]" },
            { name: "calldatas", type: "bytes[]" },
            { name: "description", type: "string" },
            { name: "slug", type: "string" },
            { name: "proposalIdToUpdate", type: "uint256" },
            { name: "reason", type: "string" },
          ],
          name: "updateProposalCandidate",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "updateProposalCandidate",
      value: updateCost,
      args: [
        targets,
        values,
        signatures,
        calldatas,
        description,
        slug,
        targetProposalId,
        updateMessage,
      ],
    }).then((hash) => {
      registerEvent("Candidate successfully updated", {
        hash,
        slug,
        account: accountAddress,
      });
      return hash;
    });
  };
};

export const useCancelProposalCandidate = (slug, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [{ type: "string" }],
          name: "cancelProposalCandidate",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "cancelProposalCandidate",
      args: [slug],
      query: {
        enabled,
      },
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Candidate successfully canceled", {
        hash,
        slug,
        account: accountAddress,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

const calcProposalEncodeData = ({
  proposerId,
  description,
  targets,
  values,
  signatures,
  calldatas,
  targetProposalId = 0,
}) => {
  const signatureHashes = signatures.map((sig) =>
    keccak256(stringToBytes(sig)),
  );

  const calldatasHashes = calldatas.map((calldata) => keccak256(calldata));

  let parameters = [
    ["address", proposerId],
    ["bytes32", keccak256(encodePacked(["address[]"], [targets]))],
    ["bytes32", keccak256(encodePacked(["uint256[]"], [values]))],
    ["bytes32", keccak256(encodePacked(["bytes32[]"], [signatureHashes]))],
    ["bytes32", keccak256(encodePacked(["bytes32[]"], [calldatasHashes]))],
    ["bytes32", keccak256(stringToBytes(description))],
  ];

  if (targetProposalId > 0)
    parameters = [["uint256", targetProposalId], ...parameters];

  const encodedData = encodeAbiParameters(
    parameters.map(([type]) => ({ type })),
    parameters.map((p) => p[1]),
  );

  return encodedData;
};

export const useAddSignatureToProposalCandidate = (
  proposerId,
  slug,
  { content, targetProposalId = 0 },
) => {
  const { address: accountAddress } = useWallet();

  const { description, targets, values, signatures, calldatas } = content;

  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return ({ signature, expirationTimestamp, reason }) =>
    writeContract({
      address: getContractAddress(chainId),
      abi: [
        {
          inputs: [
            { name: "sig", type: "bytes" },
            { name: "expirationTimestamp", type: "uint256" },
            { name: "proposer", type: "address" },
            { name: "slug", type: "string" },
            { name: "proposalIdToUpdate", type: "uint256" },
            { name: "encodedProp", type: "bytes" },
            { name: "reason", type: "string" },
          ],
          name: "addSignature",
          outputs: [],
          type: "function",
        },
      ],
      functionName: "addSignature",
      args: [
        signature,
        expirationTimestamp,
        proposerId,
        slug,
        targetProposalId,
        calcProposalEncodeData({
          proposerId,
          description,
          targets,
          values,
          signatures,
          calldatas,
          targetProposalId: Number(targetProposalId),
        }),
        reason,
      ],
    }).then((hash) => {
      registerEvent("Candidate signature successfully submitted", {
        hash,
        slug,
        account: accountAddress,
      });
      return hash;
    });
};

export const useSignProposalCandidate = () => {
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData({});

  const proposalTypes = [
    { name: "proposer", type: "address" },
    { name: "targets", type: "address[]" },
    { name: "values", type: "uint256[]" },
    { name: "signatures", type: "string[]" },
    { name: "calldatas", type: "bytes[]" },
    { name: "description", type: "string" },
    { name: "expiry", type: "uint256" },
  ];

  return (
    proposerId,
    { description, targets, values, signatures, calldatas },
    { expirationTimestamp, targetProposalId },
  ) => {
    const message = {
      proposer: proposerId,
      targets,
      values,
      signatures,
      calldatas,
      description,
      expiry: expirationTimestamp,
    };

    if (targetProposalId != null) message.proposalId = Number(targetProposalId);

    return signTypedDataAsync({
      domain: {
        name: "Nouns DAO",
        chainId,
        verifyingContract: resolveIdentifier(chainId, "dao").address,
      },
      types:
        targetProposalId == null
          ? {
              Proposal: proposalTypes,
            }
          : {
              UpdateProposal: [
                { name: "proposalId", type: "uint256" },
                ...proposalTypes,
              ],
            },
      primaryType: targetProposalId == null ? "Proposal" : "UpdateProposal",
      message,
    });
  };
};
