import React from "react";
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
  useNetwork,
  useBlockNumber,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { parse as parseTransactions } from "../utils/transactions.js";

const { indexBy, sortBy } = arrayUtils;
const { mapValues } = objectUtils;

export const contractAddressesByChainId = {
  1: {
    dao: "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d",
    data: "0xf790A5f59678dd733fb3De93493A91f472ca1365",
    token: "0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03",
  },
  11155111: {
    dao: "0x35d2670d7C8931AACdd37C89Ddcb0638c3c44A57",
    data: "0x9040f720AA8A693F950B9cF94764b4b06079D002",
    token: "0x4C4674bb72a096855496a7204962297bd7e12b85",
  },
};

const subgraphEndpointByChainId = {
  1: "https://api.thegraph.com/subgraphs/name/nounsdao/nouns-subgraph",
  // 1: "https://api.studio.thegraph.com/query/49498/nouns-v3-mainnet/version/latest",
  11155111:
    "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/version/latest",
};

const DEFAULT_CHAIN_ID = 1;

const VOTE_FIELDS = `
fragment VoteFields on Vote {
  id
  blockNumber
  reason
  supportDetailed
  votes
  voter {
    id
  }
}`;

const CANDIDATE_FEEDBACK_FIELDS = `
fragment CandidateFeedbackFields on CandidateFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  candidate {
    id
  }
}`;

const PROPOSAL_FEEDBACK_FIELDS = `
fragment ProposalFeedbackFields on ProposalFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  proposal {
    id
  }
}`;

export const useChainId = () => {
  const { chain } = useNetwork();
  return chain?.id ?? DEFAULT_CHAIN_ID;
};

const DELEGATES_QUERY = `{
  delegates(first: 1000, where: {nounsRepresented_: {}}) {
    id
    nounsRepresented {
      id
      seed {
        head
        glasses
        body
        background
        accessory
      }
    }
  }
}`;

const createProposalsQuery = ({
  skip = 0,
  first = 1000,
  includeVotes = false,
} = {}) => `
${VOTE_FIELDS}
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    description
    title
    status
    createdBlock
    createdTimestamp
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
    votes @skip(if: ${!includeVotes}) {
      ...VoteFields
    }
  }
}`;

const createProposalCandidatesQuery = ({ skip = 0, first = 1000 } = {}) => `{
  proposalCandidates(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    slug
    proposer
    createdBlock
    canceledBlock
    lastUpdatedBlock
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
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
  }
}`;

const createProposalQuery = (id) => `
${VOTE_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
query {
  proposal(id: "${id}") {
    id
    status
    title
    description
    createdBlock
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
    abstainVotes
    executionETA
    quorumVotes
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
    feedbackPosts {
      ...ProposalFeedbackFields
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
    createdBlock
    canceledBlock
    lastUpdatedBlock
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

const createProposalCandidateFeedbackPostsByCandidateQuery = (candidateId) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_:{id: "${candidateId}"}}) {
    ...CandidateFeedbackFields
  }
}`;

const createNounsActivityDataQuery = ({ startBlock, endBlock }) => `
${CANDIDATE_FEEDBACK_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
${VOTE_FIELDS}
query {
  candidateFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...CandidateFeedbackFields
  }
  proposalFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...ProposalFeedbackFields
  }
  votes(where: {blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
}`;

export const ChainDataCacheContext = React.createContext();

const subgraphFetch = ({ chainId, query }) =>
  fetch(subgraphEndpointByChainId[chainId], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);

const parseFeedbackPost = (post) => ({
  ...post,
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: new Date(parseInt(post.createdTimestamp) * 1000),
});

const parseProposal = (data) => {
  const parsedData = { ...data };

  // Block numbers
  for (const prop of [
    "createdBlock",
    "startBlock",
    "endBlock",
    "updatePeriodEndBlock",
    "objectionPeriodEndBlock",
  ]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of ["createdTimestamp", "lastUpdatedTimestamp"]) {
    if (data[prop] != null) {
      parsedData[prop] = new Date(parseInt(data[prop]) * 1000);
    }
  }

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null) parsedData.transactions = parseTransactions(data);

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

  // Block numbers
  for (const prop of ["createdBlock", "canceledBlock", "lastUpdatedBlock"]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of [
    "createdTimestamp",
    "lastUpdatedTimestamp",
    "canceledTimestamp",
  ]) {
    if (data[prop] != null) {
      parsedData[prop] = new Date(parseInt(data[prop]) * 1000);
    }
  }

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

  if (data.latestVersion.content.targets != null)
    parsedData.latestVersion.content.transactions = parseTransactions(
      data.latestVersion.content
    );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  return parsedData;
};

const parseDelegate = (data) => {
  const parsedData = { ...data };

  parsedData.nounsRepresented = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nounsRepresented.map((n) => ({
      ...n,
      seed: objectUtils.mapValues((v) => parseInt(v), n.seed),
    }))
  );

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
  const chainId = useChainId();

  const [state, setState] = React.useState({
    delegatesById: {},
    proposalsById: {},
    proposalCandidatesById: {},
  });

  const querySubgraph = React.useCallback(
    (query) => subgraphFetch({ chainId, query }),
    [chainId]
  );

  const fetchProposals = React.useCallback(
    (options) =>
      querySubgraph(createProposalsQuery(options)).then((data) => {
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
    [querySubgraph]
  );

  const fetchProposalCandidates = React.useCallback(
    (options) =>
      querySubgraph(createProposalCandidatesQuery(options)).then((data) => {
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
    [querySubgraph]
  );

  const fetchProposal = React.useCallback(
    (id) =>
      querySubgraph(createProposalQuery(id)).then((data) => {
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
    [querySubgraph]
  );

  const fetchProposalCandidate = React.useCallback(
    async (rawId) => {
      const id = rawId.toLowerCase();
      return Promise.all([
        querySubgraph(createProposalCandidateQuery(id)).then((data) => {
          if (data.proposalCandidate == null)
            return Promise.reject(new Error("not-found"));
          return data.proposalCandidate;
        }),
        querySubgraph(
          createProposalCandidateFeedbackPostsByCandidateQuery(id)
        ).then((data) => {
          if (data.candidateFeedbacks == null)
            return Promise.reject(new Error("not-found"));
          return data.candidateFeedbacks;
        }),
      ]).then(([candidate, feedbackPosts]) => {
        setState((s) => {
          const updatedCandidate = mergeProposalCandidates(
            s.proposalCandidatesById[id],
            parseProposalCandidate({ ...candidate, feedbackPosts })
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
    },
    [querySubgraph]
  );

  const fetchNounsActivity = React.useCallback(
    async ({ startBlock, endBlock }) => {
      return querySubgraph(
        createNounsActivityDataQuery({
          startBlock: startBlock.toString(),
          endBlock: endBlock.toString(),
        })
      ).then((data) => {
        if (data.candidateFeedbacks == null)
          return Promise.reject(new Error("not-found"));

        const candidateFeedbackPosts =
          data.candidateFeedbacks.map(parseFeedbackPost);
        const proposalFeedbackPosts =
          data.proposalFeedbacks.map(parseFeedbackPost);
        const { votes } = data;

        setState((s) => {
          const postsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidate.id,
            candidateFeedbackPosts
          );
          const newCandidatesById = objectUtils.mapValues(
            (feedbackPosts, candidateId) => ({
              id: candidateId,
              slug: extractSlugFromCandidateId(candidateId),
              feedbackPosts,
            }),
            postsByCandidateId
          );

          const feedbackPostsByProposalId = arrayUtils.groupBy(
            (p) => p.proposal.id,
            proposalFeedbackPosts
          );
          const votesByProposalId = arrayUtils.groupBy(
            (v) => v.proposal.id,
            votes
          );

          const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
            (feedbackPosts, proposalId) => ({
              id: proposalId,
              feedbackPosts,
            }),
            feedbackPostsByProposalId
          );
          const proposalsWithNewVotesById = objectUtils.mapValues(
            (votes, proposalId) => ({
              id: proposalId,
              votes,
            }),
            votesByProposalId
          );

          const merge = (mergingFn, ...objects_) => {
            const objects =
              typeof mergingFn === "function"
                ? objects_
                : [mergingFn, ...objects_];

            return objects.reduce((result, o) => {
              if (result == null) return o;

              return {
                ...result,
                ...mapValues((value2, key) => {
                  const value1 = result[key];

                  if (typeof mergingFn === "function")
                    return mergingFn(value1, value2, key);

                  return { ...value1, ...value2 };
                }, o),
              };
            }, null);
          };

          return {
            ...s,
            proposalsById: merge(
              s.proposalsById,
              proposalsWithNewFeedbackPostsById,
              proposalsWithNewVotesById
            ),
            proposalCandidatesById: merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              newCandidatesById
            ),
          };
        });
      });
    },
    [querySubgraph]
  );

  // Fetch delegates
  useFetch(
    () =>
      querySubgraph(DELEGATES_QUERY).then((data) => {
        const parsedDelegates = data.delegates.map(parseDelegate);
        setState((s) => {
          return {
            ...s,
            delegatesById: arrayUtils.indexBy((d) => d.id, parsedDelegates),
          };
        });
      }),
    [querySubgraph]
  );

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchProposal,
        fetchProposalCandidate,
        fetchProposals,
        fetchProposalCandidates,
        fetchNounsActivity,
      },
    }),
    [
      state,
      fetchProposal,
      fetchProposalCandidate,
      fetchProposals,
      fetchProposalCandidates,
      fetchNounsActivity,
    ]
  );

  return (
    <ChainDataCacheContext.Provider value={contextValue}>
      {children}
    </ChainDataCacheContext.Provider>
  );
};

export const extractSlugFromCandidateId = (candidateId) => {
  const slugParts = candidateId.split("-").slice(1);
  return slugParts.join("-");
};

export const getValidSponsorSignatures = (candidate) => {
  const signatures = candidate?.latestVersion?.content.contentSignatures ?? [];
  return arrayUtils
    .sortBy({ value: (i) => i.expirationTimestamp, order: "desc" }, signatures)
    .reduce((validSignatures, s) => {
      if (
        // Exclude canceled ones...
        s.canceled ||
        // ...expires ones
        s.expirationTimestamp <= new Date() ||
        // ...multiple ones from the same signer with shorter expiration
        validSignatures.some((s_) => s_.signer.id === s.signer.id)
      )
        // TODO: exclude signers who have an active or pending proposal
        return validSignatures;
      return [...validSignatures, s];
    }, []);
};

export const useDelegate = (id) => {
  const {
    state: { delegatesById },
  } = React.useContext(ChainDataCacheContext);

  return delegatesById[id?.toLowerCase()];
};

export const useProposalCandidates = () => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(() => {
    const candidates = Object.values(proposalCandidatesById);
    // Exclude canceled candidates as well as those with a matching proposal
    const filteredCandidates = candidates.filter(
      (c) => c.canceledTimestamp == null && c.latestVersion?.proposalId == null
    );
    return sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates
    );
  }, [proposalCandidatesById]);
};

export const useActions = () => {
  const { actions } = React.useContext(ChainDataCacheContext);
  return actions;
};

export const useProposalCandidateFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const onError = useLatestCallback(options?.onError);

  const {
    actions: { fetchProposalCandidate },
  } = React.useContext(ChainDataCacheContext);

  useFetch(
    () =>
      fetchProposalCandidate(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchProposalCandidate, id, onError, blockNumber]
  );
};

export const useProposalCandidate = (id) => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);
  return proposalCandidatesById[id.toLowerCase()];
};

export const useSendProposalCandidateFeedback = (
  proposerId,
  slug,
  { support, reason }
) => {
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function sendCandidateFeedback(address proposer, string memory slug, uint8 support, string memory reason) external",
    ]),
    functionName: "sendCandidateFeedback",
    args: [proposerId, slug, support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write;
};

export const useProposalCandidateVotingPower = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getValidSponsorSignatures(candidate);

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  );

  const candidateVotingPower = arrayUtils.unique([
    ...sponsoringNounIds,
    ...proposerDelegateNounIds,
  ]).length;

  return candidateVotingPower;
};

export const useCreateProposalCandidate = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const createCost = useProposalCandidateCreateCost();

  const { writeAsync } = useContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    value: createCost,
    enabled: enabled && createCost != null,
  });

  return ({
    slug,
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

export const useProposalCandidateCreateCost = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function createCandidateCost() public view returns (uint256)",
    ]),
    functionName: "createCandidateCost",
  });

  return data;
};

export const useProposalCandidateUpdateCost = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function updateCandidateCost() public view returns (uint256)",
    ]),
    functionName: "updateCandidateCost",
  });

  return data;
};

export const useUpdateProposalCandidate = (slug, { description, reason }) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const updateCost = useProposalCandidateUpdateCost();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
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
    address: contractAddressesByChainId[chainId].data,
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
  const chainId = useChainId();

  const { signTypedDataAsync } = useSignTypedData({
    domain: {
      name: "Nouns DAO",
      chainId: sepolia.id,
      verifyingContract: contractAddressesByChainId[chainId].dao,
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
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: contractAddressesByChainId[chainId].data,
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
