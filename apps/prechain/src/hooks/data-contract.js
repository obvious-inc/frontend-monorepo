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
    return write().then(({ hash }) => {
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

  return write;
};

export const useCreateProposalCandidate = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // TODO: Only pay if account has no prior votes
  const createCost = useProposalCandidateCreateCost({ enabled });

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    value: createCost,
  });

  if (createCost == null) return null;

  return async ({ slug, description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [targets, values, signatures, calldatas, description, slug, 0],
    })
      .then(({ hash }) => publicClient.waitForTransactionReceipt({ hash }))
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

export const useProposalCandidateUpdateCost = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateCandidateCost() public view returns (uint256)",
    ]),
    functionName: "updateCandidateCost",
  });

  return data;
};

export const useUpdateProposalCandidate = (
  slug,
  { description, reason, transactions }
) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const updateCost = useProposalCandidateUpdateCost();

  const { targets, values, signatures, calldatas } = unparseTransactions(
    transactions,
    { chainId }
  );

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function updateProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate, string memory reason) external payable",
    ]),
    functionName: "updateProposalCandidate",
    args: [
      targets,
      values,
      signatures,
      calldatas,
      description,
      slug,
      0,
      reason,
    ],
    value: updateCost,
    enabled: description != null && updateCost != null,
  });
  const { writeAsync } = useContractWrite(config);

  return writeAsync == null
    ? null
    : () =>
        writeAsync().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};

export const useCancelProposalCandidate = (slug) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function cancelProposalCandidate(string memory slug) external",
    ]),
    functionName: "cancelProposalCandidate",
    args: [slug],
    // value: parseEther("0.01"),
  });
  const { writeAsync: write } = useContractWrite(config);

  return write == null
    ? null
    : () =>
        write().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
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
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function addSignature(bytes memory sig, uint256 expirationTimestamp, address proposer, string memory slug, uint256 proposalIdToUpdate, bytes memory encodedProp, string memory reason) external",
    ]),
    functionName: "addSignature",
  });

  return ({ signature, expirationTimestamp, reason }) =>
    writeAsync({
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
