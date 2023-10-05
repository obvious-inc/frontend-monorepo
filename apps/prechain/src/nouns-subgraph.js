import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { parse as parseTransactions } from "./utils/transactions.js";

const betaSubgraph =
  new URLSearchParams(location.search).get("beta-subgraph") != null;

const subgraphEndpointByChainId = {
  1: betaSubgraph
    ? "https://api.studio.thegraph.com/query/49498/nouns-v3-mainnet/version/latest"
    : "https://api.thegraph.com/subgraphs/name/nounsdao/nouns-subgraph",
  11155111:
    "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/version/latest",
};

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
      owner {
        id
        delegate {
          id
        }
      }
    }
  }
}`;

const createBrowseScreenQuery = ({ skip = 0, first = 1000 } = {}) => `
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
    signers {
      id
    }
    votes {
      ...VoteFields
    }
  }

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

  proposalCandidateVersions(
    where: {content_: {matchingProposalIds_contains: ["${id}"]}}
  ) {
    proposal {
      id
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

const createProposalCandidateFeedbackPostsByCandidatesQuery = (
  candidateIds
) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_in: [${candidateIds.map(
    (id) => `"${id}"`
  )}]}, first: 1000) {
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

const subgraphFetch = async ({
  endpoint,
  chainId,
  operationName,
  query,
  variables,
}) => {
  const url = endpoint ?? subgraphEndpointByChainId[chainId];

  if (url == null) throw new Error();

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName, query, variables }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);
};

const parseFeedbackPost = (post) => ({
  ...post,
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: new Date(parseInt(post.createdTimestamp) * 1000),
  proposalId: post.proposal?.id,
  candidateId: post.candidate?.id,
});

const parseProposal = (data, { chainId }) => {
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

  if (data.description != null) {
    const firstLine = data.description.split("\n")[0];
    const startIndex = [...firstLine].findIndex((c) => c !== "#");
    parsedData.title =
      startIndex === 0 ? null : firstLine.slice(startIndex).trim();
  }

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null)
    parsedData.transactions = parseTransactions(data, { chainId });

  return parsedData;
};

const parseProposalCandidate = (data, { chainId }) => {
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
      data.latestVersion.content,
      { chainId }
    );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  return parsedData;
};

const parseDelegate = (data) => {
  const parsedData = { ...data };

  parsedData.nounsRepresented = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nounsRepresented
      .map((n) => ({
        ...n,
        seed: objectUtils.mapValues((v) => parseInt(v), n.seed),
        ownerId: n.owner?.id,
        delegateId: n.owner?.delegate?.id,
      }))
      // Don’t include nouns delegated to other accounts
      .filter((n) => n.delegateId == null || n.delegateId === data.id)
  );

  return parsedData;
};

export const fetchProposalCandidatesFeedbackPosts = async (
  chainId,
  candidateIds
) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidateFeedbackPostsByCandidatesQuery(candidateIds),
  }).then((data) => {
    if (data.candidateFeedbacks == null)
      return Promise.reject(new Error("not-found"));
    return data.candidateFeedbacks.map(parseFeedbackPost);
  });

export const fetchProposal = (chainId, id) =>
  subgraphFetch({ chainId, query: createProposalQuery(id) }).then((data) => {
    if (data.proposal == null) return Promise.reject(new Error("not-found"));
    const candidateId = data.proposalCandidateVersions[0]?.proposal.id;
    return parseProposal({ ...data.proposal, candidateId }, { chainId });
  });

export const fetchProposalCandidate = async (chainId, rawId) => {
  const id = rawId.toLowerCase();
  // TODO: merge these queries
  return Promise.all([
    subgraphFetch({
      chainId,
      query: createProposalCandidateQuery(id),
    }).then((data) => {
      if (data.proposalCandidate == null)
        return Promise.reject(new Error("not-found"));
      return data.proposalCandidate;
    }),
    subgraphFetch({
      chainId,
      query: createProposalCandidateFeedbackPostsByCandidateQuery(id),
    }).then((data) => {
      if (data.candidateFeedbacks == null)
        return Promise.reject(new Error("not-found"));
      return data.candidateFeedbacks;
    }),
  ]).then(([candidate, feedbackPosts]) =>
    parseProposalCandidate({ ...candidate, feedbackPosts }, { chainId })
  );
};

export const fetchDelegates = (chainId) =>
  subgraphFetch({ chainId, query: DELEGATES_QUERY }).then((data) =>
    data.delegates.map(parseDelegate)
  );

export const fetchBrowseScreenData = (chainId, options) =>
  subgraphFetch({ chainId, query: createBrowseScreenQuery(options) }).then(
    (data) => {
      const proposals = data.proposals.map((p) =>
        parseProposal(p, { chainId })
      );
      const candidates = data.proposalCandidates.map((c) =>
        parseProposalCandidate(c, { chainId })
      );
      return { proposals, candidates };
    }
  );

export const fetchNounsActivity = (chainId, { startBlock, endBlock }) =>
  subgraphFetch({
    chainId,
    query: createNounsActivityDataQuery({
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
    }),
  }).then((data) => {
    if (data.candidateFeedbacks == null)
      return Promise.reject(new Error("not-found"));

    const candidateFeedbackPosts =
      data.candidateFeedbacks.map(parseFeedbackPost);
    const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
    const { votes } = data;

    return { votes, proposalFeedbackPosts, candidateFeedbackPosts };
  });
