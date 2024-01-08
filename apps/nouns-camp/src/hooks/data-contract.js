import va from "@vercel/analytics";
import {
  parseAbi,
  stringToBytes,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  decodeEventLog,
} from "viem";
import {
  usePublicClient,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useSignTypedData,
  useBlockNumber,
} from "wagmi";
import { unparse as unparseTransactions } from "../utils/transactions.js";
import { useWallet } from "./wallet.js";
import { resolveIdentifier } from "../contracts.js";
import { useCurrentVotes } from "./token-contract.js";
import { useActions } from "../store.js";
import useChainId from "./chain-id.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "data").address;

export const useSendProposalCandidateFeedback = (
  proposerId,
  slug,
  { support, reason }
) => {
  const chainId = useChainId();
  const { address: accountAddress } = useWallet();

  const { addOptimitisicCandidateFeedbackPost } = useActions();

  const { data: blockNumber } = useBlockNumber();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function sendCandidateFeedback(address proposer, string memory slug, uint8 support, string memory reason) external",
    ]),
    functionName: "sendCandidateFeedback",
    args: [proposerId, slug, support, reason],
    enabled: support != null,
  });
  const { writeAsync: write } = useContractWrite(config);

  if (write == null) return null;

  return async () => {
    const candidateId = [proposerId, slug].join("-").toLowerCase();
    const voterId = accountAddress.toLowerCase();
    va.track("Feedback", { candidateId, account: accountAddress });
    return write().then(({ hash }) => {
      va.track("Candidate feedback successfully submitted", {
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
      return { hash };
    });
  };
};

export const useSendProposalFeedback = (proposalId, { support, reason }) => {
  const { address: accountAddress } = useWallet();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function sendFeedback(uint256 proposalId, uint8 support, string memory reason) external",
    ]),
    functionName: "sendFeedback",
    args: [parseInt(proposalId), support, reason],
    enabled: support != null,
  });
  const { writeAsync: write } = useContractWrite(config);

  if (write == null) return null;

  return async () => {
    va.track("Feedback", {
      proposalId,
      account: accountAddress,
    });

    return write().then(({ hash }) => {
      va.track("Proposal feedback successfully submitted", {
        proposalId,
        hash,
        account: accountAddress,
      });
      return { hash };
    });
  };
};

export const useCreateProposalCandidate = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { address: accountAddress } = useWallet();
  const votingPower = useCurrentVotes(accountAddress);

  const createCost = useProposalCandidateCreateCost({ enabled });

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    value: votingPower > 0 ? 0 : createCost,
  });

  if (votingPower == null || createCost == null) return null;

  return async ({ slug, description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [targets, values, signatures, calldatas, description, slug, 0],
    })
      .then(({ hash }) => {
        va.track("Candidate successfully created", {
          hash,
          slug,
          account: accountAddress,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[0];
        const decodedEvent = decodeEventLog({
          abi: parseAbi([
            "event ProposalCandidateCreated(address indexed msgSender, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description, string slug, uint256 proposalIdToUpdate, bytes32 encodedProposalHash)",
          ]),
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useProposalCandidateCreateCost = ({ enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function createCandidateCost() public view returns (uint256)",
    ]),
    functionName: "createCandidateCost",
    enabled,
  });

  return data;
};

export const useProposalCandidateUpdateCost = ({ enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateCandidateCost() public view returns (uint256)",
    ]),
    functionName: "updateCandidateCost",
    enabled,
  });

  return data;
};

export const useUpdateProposalCandidate = (slug, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();

  const updateCost = useProposalCandidateUpdateCost({ enabled });

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate, string memory reason) external payable",
    ]),
    functionName: "updateProposalCandidate",
    value: updateCost,
  });

  if (writeAsync == null) return null;

  return async ({ description, transactions, updateMessage }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );
    return writeAsync({
      args: [
        targets,
        values,
        signatures,
        calldatas,
        description,
        slug,
        0,
        updateMessage,
      ],
    }).then(({ hash }) => {
      va.track("Candidate successfully updated", {
        hash,
        slug,
        account: accountAddress,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
  };
};

export const useCancelProposalCandidate = (slug, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function cancelProposalCandidate(string memory slug) external",
    ]),
    functionName: "cancelProposalCandidate",
    args: [slug],
    enabled,
  });
  const { writeAsync: write } = useContractWrite(config);

  if (write == null) return null;

  return () =>
    write().then(({ hash }) => {
      va.track("Candidate successfully canceled", {
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
}) => {
  const signatureHashes = signatures.map((sig) =>
    keccak256(stringToBytes(sig))
  );

  const calldatasHashes = calldatas.map((calldata) => keccak256(calldata));

  const encodedData = encodeAbiParameters(
    ["address", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"].map(
      (type) => ({ type })
    ),
    [
      proposerId,
      keccak256(encodePacked(["address[]"], [targets])),
      keccak256(encodePacked(["uint256[]"], [values])),
      keccak256(encodePacked(["bytes32[]"], [signatureHashes])),
      keccak256(encodePacked(["bytes32[]"], [calldatasHashes])),
      keccak256(stringToBytes(description)),
    ]
  );

  return encodedData;
};

export const useAddSignatureToProposalCandidate = (
  proposerId,
  slug,
  { description, targets, values, signatures, calldatas }
) => {
  const { address: accountAddress } = useWallet();

  const chainId = useChainId();

  const { writeAsync: write } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function addSignature(bytes memory sig, uint256 expirationTimestamp, address proposer, string memory slug, uint256 proposalIdToUpdate, bytes memory encodedProp, string memory reason) external",
    ]),
    functionName: "addSignature",
  });

  if (write == null) return null;

  return ({ signature, expirationTimestamp, reason }) =>
    write({
      args: [
        signature,
        expirationTimestamp,
        proposerId,
        slug,
        0, // proposalIdToUpdate,
        calcProposalEncodeData({
          proposerId,
          description,
          targets,
          values,
          signatures,
          calldatas,
        }),
        reason,
      ],
    }).then(({ hash }) => {
      va.track("Candidate signature successfully submitted", {
        hash,
        slug,
        account: accountAddress,
      });
      return { hash };
    });
};

export const useSignProposalCandidate = (
  proposerId,
  { description, targets, values, signatures, calldatas },
  { expirationTimestamp }
) => {
  const chainId = useChainId();

  const { signTypedDataAsync } = useSignTypedData({
    domain: {
      name: "Nouns DAO",
      chainId,
      verifyingContract: resolveIdentifier(chainId, "dao").address,
    },
    types: {
      Proposal: [
        { name: "proposer", type: "address" },
        { name: "targets", type: "address[]" },
        { name: "values", type: "uint256[]" },
        { name: "signatures", type: "string[]" },
        { name: "calldatas", type: "bytes[]" },
        { name: "description", type: "string" },
        { name: "expiry", type: "uint256" },
      ],
    },
    primaryType: "Proposal",
    message: {
      proposer: proposerId,
      targets,
      values,
      signatures,
      calldatas,
      description,
      expiry: expirationTimestamp,
    },
  });

  return signTypedDataAsync;
};
