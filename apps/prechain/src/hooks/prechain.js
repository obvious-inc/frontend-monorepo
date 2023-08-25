import React from "react";
import {
  parseAbi,
  parseEther,
  stringToBytes,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  decodeEventLog,
} from "viem";
import {
  usePublicClient,
  useContractWrite,
  usePrepareContractWrite,
  useSignTypedData,
  useBlockNumber,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  useActions as useNomActions,
  usePublicChannels,
} from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";

const { indexBy, sortBy } = arrayUtils;
const { mapValues } = objectUtils;

export const SEPOLIA_NOUNS_DAO_CONTRACT =
  "0x35d2670d7C8931AACdd37C89Ddcb0638c3c44A57";
export const SEPOLIA_NOUNS_TOKEN_CONTRACT =
  "0x4C4674bb72a096855496a7204962297bd7e12b85";
const SEPOLIA_NOUNS_DATA_CONTACT = "0x9040f720AA8A693F950B9cF94764b4b06079D002";

const SUBGRAPH_ENDPOINT =
  "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/version/latest";

const PROPOSALS_TAG = "prechain/1/proposal";

const EXECUTION_GRACE_PERIOD_IN_MILLIS = 1000 * 60 * 60 * 24 * 21; // 21 days

export const useActions = () => {
  const { fetchPubliclyReadableChannels, createOpenChannel } = useNomActions();

  const fetchChannels = React.useCallback(
    () => fetchPubliclyReadableChannels({ tags: [PROPOSALS_TAG] }),
    [fetchPubliclyReadableChannels]
  );

  const createChannel = React.useCallback(
    (properties) => createOpenChannel({ ...properties, tags: [PROPOSALS_TAG] }),
    [createOpenChannel]
  );

  return { fetchChannels, createChannel };
};

export const useChannels = (options) => {
  const channels = usePublicChannels(options);
  return React.useMemo(
    () =>
      channels.filter((c) => c.tags != null && c.tags.includes(PROPOSALS_TAG)),
    [channels]
  );
};

const PROPOSALS_QUERY = `{
  proposals {
    id
    description
    title
    status
    createdTimestamp
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    forVotes
    againstVotes
    proposer {
      id
    }
  }
}`;

const PROPOSAL_CANDIDATES_QUERY = `{
  proposalCandidates {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        matchingProposalIds
        proposalIdToUpdate
      }
    }
  }
}`;

const createProposalQuery = (id) => `{
  proposal(id: "${id}") {
    id
    status
    title
    description
    createdTimestamp
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      id
      blockNumber
      reason
      supportDetailed
      votes
      voter {
        id
      }
    }
    feedbackPosts {
      id
      reason
      supportDetailed
      createdTimestamp
      votes
      voter {
        id
      }
    }
  }
}`;

const createProposalCandidateQuery = (id) => `{
  proposalCandidate(id: "${id}") {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        description
        targets
        values
        signatures
        calldatas
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          reason
          canceled
          expirationTimestamp
          signer {
            id
            nounsRepresented {
              id
            }
          }
        }
      }
    }
    versions {
      id
    }
  }
}`;

const createProposalCandidateFeedbackPostsQuery = (candidateId) => `{
  candidateFeedbacks(where: {candidate_:{id: "${candidateId}"}}) {
    id
    reason
    supportDetailed
    createdTimestamp
    votes
    voter {
      id
    }
    candidate {
      id
    }
  }
}`;

const ChainDataCacheContext = React.createContext();

const subgraphFetch = (query) =>
  fetch(SUBGRAPH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);

const parseProposal = (data) => {
  const parsedData = { ...data };

  parsedData.createdTimestamp = new Date(
    parseInt(data.createdTimestamp) * 1000
  );

  parsedData.lastUpdatedTimestamp = new Date(
    parseInt(data.lastUpdatedTimestamp) * 1000
  );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = sortBy(
      (p) => p.createdTimestamp,
      data.feedbackPosts.map((p) => ({
        ...p,
        createdTimestamp: new Date(parseInt(p.createdTimestamp) * 1000),
      }))
    );

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  return parsedData;
};

const parseProposalCandidate = (data) => {
  const parsedData = {
    ...data,
    latestVersion: {
      ...data.latestVersion,
      content: { ...data.latestVersion.content },
    },
  };

  parsedData.proposerId = data.proposer;

  parsedData.createdTimestamp = new Date(
    parseInt(data.createdTimestamp) * 1000
  );
  parsedData.lastUpdatedTimestamp = new Date(
    parseInt(data.lastUpdatedTimestamp) * 1000
  );

  if (data.canceledTimestamp != null)
    parsedData.canceledTimestamp = new Date(
      parseInt(data.canceledTimestamp) * 1000
    );

  if (data.latestVersion.content.matchingProposalIds != null)
    parsedData.latestVersion.proposalId =
      data.latestVersion.content.matchingProposalIds[0];

  if ((data.latestVersion.content.proposalIdToUpdate ?? "0") !== "0")
    parsedData.latestVersion.targetProposalId =
      data.latestVersion.content.proposalIdToUpdate;

  if (data.latestVersion.content.contentSignatures != null)
    parsedData.latestVersion.content.contentSignatures =
      data.latestVersion.content.contentSignatures.map((s) => ({
        ...s,
        expirationTimestamp: new Date(parseInt(s.expirationTimestamp) * 1000),
      }));

  return parsedData;
};

const mergeProposalCandidates = (p1, p2) => {
  const mergedCandidate = { ...p1, ...p2 };
  if (p1?.latestVersion == null || p2?.latestVersion == null)
    return mergedCandidate;

  mergedCandidate.latestVersion = { ...p1.latestVersion, ...p2.latestVersion };

  if (p2.latestVersion.content == null) return mergedCandidate;

  mergedCandidate.latestVersion.content = {
    ...p1.latestVersion.content,
    ...p2.latestVersion.content,
  };

  return mergedCandidate;
};

export const ChainDataCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    proposalsById: {},
    proposalCandidatesById: {},
  });

  // Fetch proposals
  useFetch(
    () =>
      subgraphFetch(PROPOSALS_QUERY).then((data) => {
        const parsedProposals = data.proposals.map(parseProposal);
        const fetchedProposalsById = indexBy((p) => p.id, parsedProposals);

        setState((s) => {
          const mergedExistingProposalsById = mapValues(
            (p) => ({ ...p, ...fetchedProposalsById[p.id] }),
            s.proposalsById
          );

          return {
            ...s,
            proposalsById: {
              ...fetchedProposalsById,
              ...mergedExistingProposalsById,
            },
          };
        });
      }),
    []
  );

  // Fetch candidates
  useFetch(
    () =>
      subgraphFetch(PROPOSAL_CANDIDATES_QUERY).then((data) => {
        const parsedCandidates = data.proposalCandidates.map(
          parseProposalCandidate
        );
        const fetchedCandidatesById = indexBy(
          (p) => p.id.toLowerCase(),
          parsedCandidates
        );

        setState((s) => {
          const mergedExistingCandidatesById = mapValues(
            (c) => mergeProposalCandidates(c, fetchedCandidatesById[c.id]),
            s.proposalCandidatesById
          );

          return {
            ...s,
            proposalCandidatesById: {
              ...fetchedCandidatesById,
              ...mergedExistingCandidatesById,
            },
          };
        });
      }),
    []
  );

  const fetchProposal = React.useCallback(
    (id) =>
      subgraphFetch(createProposalQuery(id)).then((data) => {
        if (data.proposal == null)
          return Promise.reject(new Error("not-found"));

        const fetchedProposal = parseProposal(data.proposal);

        setState((s) => {
          const existingProposal = s.proposalsById[id];
          return {
            ...s,
            proposalsById: {
              ...s.proposalsById,
              [id]: { ...existingProposal, ...fetchedProposal },
            },
          };
        });
      }),
    []
  );

  const fetchProposalCandidate = React.useCallback(async (rawId) => {
    const id = rawId.toLowerCase();
    return Promise.all([
      subgraphFetch(createProposalCandidateQuery(id)).then((data) => {
        if (data.proposalCandidate == null)
          return Promise.reject(new Error("not-found"));

        return parseProposalCandidate(data.proposalCandidate);
      }),
      subgraphFetch(createProposalCandidateFeedbackPostsQuery(id)).then(
        (data) => {
          if (data.candidateFeedbacks == null)
            return Promise.reject(new Error("not-found"));

          const feedbackPosts = data.candidateFeedbacks.map((p) => ({
            ...p,
            createdTimestamp: new Date(parseInt(p.createdTimestamp) * 1000),
          }));

          return feedbackPosts;
        }
      ),
    ]).then(([candidate, feedbackPosts]) => {
      setState((s) => {
        const updatedCandidate = mergeProposalCandidates(
          s.proposalCandidatesById[id],
          { ...candidate, feedbackPosts }
        );
        return {
          ...s,
          proposalCandidatesById: {
            ...s.proposalCandidatesById,
            [id]: updatedCandidate,
          },
        };
      });
    });
  }, []);

  const contextValue = React.useMemo(
    () => ({ state, actions: { fetchProposal, fetchProposalCandidate } }),
    [state, fetchProposal, fetchProposalCandidate]
  );

  return (
    <ChainDataCacheContext.Provider value={contextValue}>
      {children}
    </ChainDataCacheContext.Provider>
  );
};

export const useProposals = () => {
  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(
    () => sortBy((p) => p.lastUpdatedTimestamp, Object.values(proposalsById)),
    [proposalsById]
  );
};

export const useProposalCandidates = () => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(() => {
    const candidates = Object.values(proposalCandidatesById);
    // Exclude canceled candidates as well as those with a matching proposal
    const filteredCandidates = candidates.filter(
      (c) => c.canceledTimestamp == null && c.latestVersion.proposalId == null
    );
    return sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates
    );
  }, [proposalCandidatesById]);
};

export const useProposalFetch = (id) => {
  const {
    actions: { fetchProposal },
  } = React.useContext(ChainDataCacheContext);

  useFetch(() => fetchProposal(id), [fetchProposal, id]);
};

export const useProposalCandidateFetch = (id) => {
  const {
    actions: { fetchProposalCandidate },
  } = React.useContext(ChainDataCacheContext);

  useFetch(() => fetchProposalCandidate(id), [fetchProposalCandidate, id]);
};

export const useProposalCandidate = (id) => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);
  return proposalCandidatesById[id.toLowerCase()];
};

export const useProposal = (id) => {
  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);
  return proposalsById[id];
};

export const isPropsalDefeated = (proposal) =>
  proposal.forVotes <= proposal.againstVotes ||
  proposal.forVotes < proposal.quorumVotes;

export const getProposalState = (proposal, { blockNumber }) => {
  if (proposal.status === "VETOED") return "vetoed";
  if (proposal.status === "CANCELLED") return "cancelled";
  if (blockNumber <= proposal.updatePeriodEndBlock) return "updatable";
  if (blockNumber <= proposal.startBlock) return "pending";
  if (blockNumber <= proposal.endBlock) return "active";
  if (blockNumber <= proposal.objectionPeriodEndBlock)
    return "objection-period";

  if (isPropsalDefeated(proposal)) return "defeated";

  if (proposal.executionETA == null) return "succeeded"; // Not yet queued

  if (proposal.status === "EXECUTED") return "executed";

  if (
    new Date().getTime() >=
    parseInt(proposal.executionETA) * 1000 + EXECUTION_GRACE_PERIOD_IN_MILLIS
  )
    return "expired";

  return "queued";
};

export const useProposalState = (proposalId) => {
  const { data: blockNumber } = useBlockNumber();

  const proposal = useProposal(proposalId);

  if (proposal == null || blockNumber == null) return null;

  return getProposalState(proposal, { blockNumber });
};

export const useSendProposalFeedback = (proposalId, { support, reason }) => {
  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function sendFeedback(uint256 proposalId, uint8 support, string memory reason) external",
    ]),
    functionName: "sendFeedback",
    args: [parseInt(proposalId), support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write;
};

export const useSendProposalCandidateFeedback = (
  proposerId,
  slug,
  { support, reason }
) => {
  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function sendCandidateFeedback(address proposer, string memory slug, uint8 support, string memory reason) external",
    ]),
    functionName: "sendCandidateFeedback",
    args: [proposerId, slug, support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write;
};

export const useCreateProposalCandidate = ({ slug, description }) => {
  const publicClient = usePublicClient();

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    args: [
      // Target addresses
      ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
      // Values
      ["0"],
      // Function signatures
      [""],
      // Calldatas
      ["0x"],
      description,
      slug,
      0,
    ],
    value: parseEther("0.01"),
    enabled: description != null,
  });
  const { writeAsync } = useContractWrite(config);

  if (writeAsync == null) return null;

  return () =>
    writeAsync()
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

export const useUpdateProposalCandidate = (slug, { description, reason }) => {
  const publicClient = usePublicClient();

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function updateProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate, string memory reason) external payable",
    ]),
    functionName: "updateProposalCandidate",
    args: [
      // Target addresses
      ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
      // Values
      ["0"],
      // Function signatures
      [""],
      // Calldatas
      ["0x"],
      description,
      slug,
      0,
      reason,
    ],
    value: parseEther("0.01"),
  });
  const { writeAsync: write } = useContractWrite(config);

  return write == null
    ? null
    : () =>
        write().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};

export const useCancelProposalCandidate = (slug) => {
  const publicClient = usePublicClient();

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
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

export const useSignProposalCandidate = (
  proposerId,
  { description, targets, values, signatures, calldatas },
  { expirationTimestamp }
) => {
  const { signTypedDataAsync } = useSignTypedData({
    domain: {
      name: "Nouns DAO",
      chainId: sepolia.id,
      verifyingContract: SEPOLIA_NOUNS_DAO_CONTRACT,
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
  const { writeAsync } = useContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
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

export const useCreateProposal = ({
  // targets,
  // values,
  // signatures,
  // calldatas,
  description,
}) => {
  const publicClient = usePublicClient();

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DAO_CONTRACT,
    abi: parseAbi([
      "function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
    ]),
    functionName: "propose",
    args: [
      // Target addresses
      ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
      // Values
      ["0"],
      // Function signatures
      [""],
      // Calldatas
      ["0x"],
      description,
    ],
    enabled: description != null,
  });

  const { writeAsync } = useContractWrite(config);

  if (writeAsync == null) return null;

  return () =>
    writeAsync()
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

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DAO_CONTRACT,
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
