import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { mainnet, sepolia, goerli } from "./chains.js";
import { parse as parseTransactions } from "./utils/transactions.js";

const customSubgraphEndpoint =
  typeof location === "undefined"
    ? null
    : new URLSearchParams(location.search).get("nouns-subgraph");

const subgraphEndpointByChainId = {
  [mainnet.id]: process.env.NEXT_PUBLIC_NOUNS_MAINNET_SUBGRAPH_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_NOUNS_SEPOLIA_SUBGRAPH_URL,
  [goerli.id]: process.env.NEXT_PUBLIC_NOUNS_GOERLI_SUBGRAPH_URL,
};

const parseTimestamp = (unixSeconds) => new Date(parseInt(unixSeconds) * 1000);

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
  proposal {
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

// eslint-disable-next-line no-unused-vars
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

const FULL_PROPOSAL_FIELDS = `
${VOTE_FIELDS}
fragment FullProposalFields on Proposal {
  id
  status
  title
  description
  createdBlock
  createdTimestamp
  startBlock
  endBlock
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
  votes {
    ...VoteFields
  }
}
`;

const CANDIDATE_CONTENT_SIGNATURE_FIELDS = `
fragment CandidateContentSignatureFields on ProposalCandidateSignature {
  reason
  canceled
  createdBlock
  createdTimestamp
  expirationTimestamp
  sig
  signer {
    id
    nounsRepresented {
      id
    }
  }
  content {
    id
  }
}`;

const DELEGATION_EVENT_FIELDS = `
fragment DelegationEventFields on DelegationEvent {
  id
  noun {
    id
  }
  newDelegate {
    id
  }
  previousDelegate {
    id
  }
  delegator {
    id
  }
  blockNumber
  blockTimestamp
}`;

const TRANSFER_EVENT_FIELDS = `
fragment TransferEventFields on TransferEvent {
  id
  noun {
    id
  }
  newHolder {
    id
  }
  previousHolder {
    id
  }
  blockNumber
  blockTimestamp
}`;

const createDelegatesQuery = ({
  includeVotes = false,
  includeZeroVotingPower = false,
} = {}) => `
query {
  delegates(first: 1000${
    // accountIds != null
    //   ? `, where: {id_in: [${accountIds.map((id) => `"${id.toLowerCase()}"`)}]}`
    !includeZeroVotingPower
      ? ", where: {nounsRepresented_: {}}"
      : ", where: {votes_: {}}"
  }) {
    id
    delegatedVotes
    ${
      includeVotes
        ? `
      votes(first: 1000, orderBy: blockNumber, orderDirection: desc) {
        id
        blockNumber
        supportDetailed
        reason
      }`
        : ""
    }
    nounsRepresented(first: 1000) {
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

const createDelegateQuery = (id) => `
  ${VOTE_FIELDS}
  query {
    delegate(id: "${id}") {
      id
      delegatedVotes
      nounsRepresented(first: 1000) {
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
      votes (first: 1000, orderBy: blockNumber, orderDirection: desc) {
        ...VoteFields
      }
      proposals (first: 1000, orderBy: createdBlock, orderDirection: desc) {
        id
        description
        title
        status
        createdBlock
        createdTimestamp
        startBlock
        endBlock
        forVotes
        againstVotes
        abstainVotes
        quorumVotes
        executionETA
        proposer {
          id
        }
      }
    }
}`;

const createAccountQuery = (id) => `
  ${DELEGATION_EVENT_FIELDS}
  ${TRANSFER_EVENT_FIELDS}
  query {
    account(id: "${id}") {
      id
      delegate {
        id
      }
      nouns {
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
    transferEvents(orderBy: blockNumber, orderDirection: desc, where: {or: [{newHolder: "${id}"}, {previousHolder: "${id}"}]}) {
      ...TransferEventFields
    }
    delegationEvents(orderBy: blockNumber, orderDirection: desc, where: {or: [{newDelegate: "${id}"}, {previousDelegate: "${id}"}, {delegator: "${id}"}]}) {
      ...DelegationEventFields
    }
  }
`;

const createBrowseScreenQuery = ({ skip = 0, first = 1000 } = {}) => `
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    title
    status
    createdBlock
    createdTimestamp
    startBlock
    endBlock
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
  }
}`;

// TODO: proposal feedbacks
const createBrowseScreenSecondaryQuery = ({
  proposalIds,
  candidateIds, // eslint-disable-line no-unused-vars
} = {}) => `
${VOTE_FIELDS}
query {
  proposals(where: {id_in: [${proposalIds.map((id) => `"${id}"`)}]}) {
    id
    votes {
      ...VoteFields
    }
  }
}`;

const createVoterScreenQuery = (id, { skip = 0, first = 1000 } = {}) => `
${VOTE_FIELDS}
${DELEGATION_EVENT_FIELDS}
${TRANSFER_EVENT_FIELDS}
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}, where: {proposer: "${id}"} ) {
    id
    description
    title
    status
    createdBlock
    createdTimestamp
    startBlock
    endBlock
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
    votes {
      ...VoteFields
    }
  }

  votes (orderBy: blockNumber, orderDirection: desc, skip: ${skip}, first: ${first}, where: {voter: "${id}"}) {
    ...VoteFields
  }
  nouns (where: {owner: "${id}"}) {
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
  transferEvents(orderBy: blockNumber, orderDirection: desc, skip: ${skip}, first: ${first}, where: {or: [{newHolder: "${id}"}, {previousHolder: "${id}"}]}) {
    ...TransferEventFields
  }
  delegationEvents(orderBy: blockNumber, orderDirection: desc, skip: ${skip}, first: ${first}, where: {or: [{newDelegate: "${id}"}, {previousDelegate: "${id}"}, {delegator: "${id}"}]}) {
    ...DelegationEventFields
  }
}`;

const createProposalCandidateSignaturesByAccountQuery = (
  id,
  { skip = 0, first = 1000 } = {},
) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidateSignatures(skip: ${skip}, first: ${first}, where: {signer: "${id}"}) {
    ...CandidateContentSignatureFields
  }
}`;

const createProposalCandidateVersionByContentIdsQuery = (contentIds) => `
query {
  proposalCandidateVersions(where: {content_in: [${contentIds.map(
    (id) => `"${id}"`,
  )}]}) {
    id
    createdBlock
    createdTimestamp
    updateMessage
    proposal {
      id
    }
    content {
      id
    }
  }
}`;

const createProposalCandidateByLatestVersionIdsQuery = (versionIds) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: {latestVersion_in: [${versionIds.map(
    (id) => `"${id}"`,
  )}]}) {
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
          ...CandidateContentSignatureFields
        }
      }
    }
    versions {
      id
    }
  }
}`;

const createProposalQuery = (id) => `
${FULL_PROPOSAL_FIELDS}
query {
  proposal(id: "${id}") {
    ...FullProposalFields
  }
}`;

const createProposalCandidateQuery = (id) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidate(id: ${JSON.stringify(id)}) {
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
          ...CandidateContentSignatureFields
        }
      }
    }
    versions {
      id
      createdBlock
      createdTimestamp
      updateMessage
      content {
        title
        description
        targets
        values
        signatures
        calldatas
      }
    }
  }
}`;

const createProposalCandidatesByAccountQuery = (accountAddress) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: { proposer: "${accountAddress}" }) {
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
          ...CandidateContentSignatureFields
        }
      }
    }
  }
}`;

const createProposalCandidateFeedbackPostsByCandidateQuery = (candidateId) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_:{id: ${JSON.stringify(candidateId)}}}) {
    ...CandidateFeedbackFields
  }
}`;

const createProposalsVersionsQuery = (proposalIds) => `{
  proposalVersions(where: {proposal_in: [${proposalIds.map(
    (id) => `"${id}"`,
  )}]}) {
    createdAt
    createdBlock
    updateMessage
    proposal {
      id
    }
  }
}`;

const createProposalsQuery = (proposalIds) => `
${FULL_PROPOSAL_FIELDS}
query {
  proposals(where: {id_in: [${proposalIds.map((id) => `"${id}"`)}]}) {
    ...FullProposalFields
  }
}`;

const createActiveProposalQuery = (currentBlock) => `
${FULL_PROPOSAL_FIELDS}
query {
  proposals(
    where: {
      and: [
        { status_not_in: [CANCELLED, VETOED] },
        {
          or: [
            { endBlock_gt: ${currentBlock} },
          ]
        }
      ]
    }
  ) {
    ...FullProposalFields
  }
}`;

const createProposalCandidatesQuery = (candidateIds) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: {id_in: [${candidateIds.map((id) =>
    JSON.stringify(id),
  )}]}) {
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
          ...CandidateContentSignatureFields
        }
      }
    }
  }
}`;

const createNounsByIdsQuery = (ids) => `
${TRANSFER_EVENT_FIELDS}
${DELEGATION_EVENT_FIELDS}
query {
  nouns(where: {id_in: [${ids.map((id) => `"${id}"`)}]}) {
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
  transferEvents(orderBy: blockNumber, orderDirection: desc, where: {noun_in: [${ids.map(
    (id) => `"${id}"`,
  )}]}) {
    ...TransferEventFields
  }
  delegationEvents(orderBy: blockNumber, orderDirection: desc, where: {noun_in: [${ids.map(
    (id) => `"${id}"`,
  )}]}) {
    ...DelegationEventFields
  }
  auctions(where: {noun_in: [${ids.map((id) => `"${id}"`)}]}) {
    id
    amount
    startTime
  }
}`;

const createProposalCandidateFeedbackPostsByCandidatesQuery = (
  candidateIds,
) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_in: [${candidateIds.map((id) =>
    JSON.stringify(id),
  )}]}, first: 1000) {
    ...CandidateFeedbackFields
  }
}`;

const createNounsActivityDataQuery = ({ startBlock, endBlock }) => `
${VOTE_FIELDS}
query {
  votes(where: {blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
}`;

const createVoterActivityDataQuery = (id, { startBlock, endBlock }) => `
${VOTE_FIELDS}
${TRANSFER_EVENT_FIELDS}
${DELEGATION_EVENT_FIELDS}
query {
  votes(where: {voter: "${id}", blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
  transferEvents(orderBy: blockNumber, orderDirection: desc, first: 1000, where: {and: [{blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, {or: [{newHolder: "${id}"}, {previousHolder: "${id}"}]}]})
  {
    ...TransferEventFields
  }
  delegationEvents(orderBy: blockNumber, orderDirection: desc, first: 1000, where: {and: [{blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, {or: [{newDelegate: "${id}"}, {previousDelegate: "${id}"}, {delegator: "${id}"}]}]})
  {
    ...DelegationEventFields
  }
}`;

export const subgraphFetch = async ({
  endpoint,
  chainId,
  operationName,
  query,
  variables,
}) => {
  const url =
    endpoint ?? customSubgraphEndpoint ?? subgraphEndpointByChainId[chainId];

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

const parseMarkdownDescription = (string) => {
  const [firstLine, ...restLines] = string.trim().split("\n");
  const startIndex = [...firstLine].findIndex((c) => c !== "#");
  const hasTitle = startIndex > 0;
  const title = hasTitle ? firstLine.slice(startIndex).trim() : null;
  const body = hasTitle ? restLines.join("\n").trim() : string;
  return { title, body };
};

const parseFeedbackPost = (post) => ({
  id: post.id,
  reason: post.reason,
  support: post.supportDetailed,
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: parseTimestamp(post.createdTimestamp),
  votes: Number(post.votes),
  proposalId: post.proposal?.id,
  candidateId: post.candidate?.id,
  voterId: post.voter.id,
  voter: post.voter,
});

const parseProposalVote = (v) => ({
  id: v.id,
  createdBlock: BigInt(v.blockNumber),
  createdTimestamp:
    v.blockTimestamp == null ? undefined : parseTimestamp(v.blockTimestamp),
  reason: v.reason,
  support: v.supportDetailed,
  votes: v.votes == null ? undefined : Number(v.votes),
  voterId: v.voter?.id,
  proposalId: v.proposal?.id,
});

const parseProposalVersion = (v) => ({
  updateMessage: v.updateMessage,
  createdBlock: BigInt(v.createdBlock),
  createdTimestamp: parseTimestamp(v.createdAt),
  proposalId: v.proposal?.id,
});

export const parseProposal = (data, { chainId }) => {
  const parsedData = { ...data };

  // Block numbers
  for (const prop of [
    "createdBlock",
    "startBlock",
    "endBlock",
    "updatePeriodEndBlock",
    "objectionPeriodEndBlock",
    "lastUpdatedBlock",
    "canceledBlock",
    "executedBlock",
    "queuedBlock",
  ]) {
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
    "executedTimestamp",
    "queuedTimestamp",
  ]) {
    if (data[prop] != null) {
      parsedData[prop] = parseTimestamp(data[prop]);
    }
  }

  if (data.executionETA !== undefined)
    parsedData.executionEtaTimestamp =
      data.executionETA == null ? null : parseTimestamp(data.executionETA);

  // Regular numbers
  for (const prop of ["forVotes", "againstVotes", "abstainVotes"]) {
    if (data[prop] != null) {
      parsedData[prop] = Number(data[prop]);
    }
  }

  if (data.description != null) {
    const { title, body } = parseMarkdownDescription(data.description);
    parsedData.title = title;
    parsedData.body = body;
  }

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.versions != null)
    parsedData.versions = data.versions.map(parseProposalVersion);

  if (data.votes != null)
    parsedData.votes = data.votes
      .map(parseProposalVote)
      .filter((v) => !hideProposalVote(v));

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null)
    parsedData.transactions = parseTransactions(data, { chainId });

  return parsedData;
};

// Hide proposal votes from 0 voting power account if no reason is given
const hideProposalVote = (v) =>
  v.votes === 0 && (v.reason?.trim() ?? "") === "";

const parseCandidateVersion = (v, { chainId }) => {
  const parsedVersion = { ...v };

  if (v.createdBlock != null)
    parsedVersion.createdBlock = BigInt(v.createdBlock);

  if (v.createdTimestamp != null)
    parsedVersion.createdTimestamp = parseTimestamp(v.createdTimestamp);

  if (v.content?.description != null) {
    const { title, body } = parseMarkdownDescription(v.content.description);

    parsedVersion.content.title = title;
    parsedVersion.content.body = body;
  }

  if (v.content?.matchingProposalIds != null)
    parsedVersion.proposalId = v.content.matchingProposalIds[0];

  if ((v.content?.proposalIdToUpdate ?? "0") !== "0")
    parsedVersion.targetProposalId = v.content.proposalIdToUpdate;

  if (v.content?.contentSignatures != null)
    parsedVersion.content.contentSignatures = v.content.contentSignatures.map(
      (s) => ({
        ...s,
        createdBlock: BigInt(s.createdBlock),
        createdTimestamp: parseTimestamp(s.createdTimestamp),
        expirationTimestamp: parseTimestamp(s.expirationTimestamp),
      }),
    );

  if (v.content?.targets != null)
    parsedVersion.content.transactions = parseTransactions(v.content, {
      chainId,
    });

  if (v.proposal != null) parsedVersion.candidateId = v.proposal.id;

  return parsedVersion;
};

export const parseCandidate = (data, { chainId }) => {
  const parsedData = {
    ...data,
    latestVersion: {
      ...data.latestVersion,
      content: { ...data.latestVersion?.content },
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
      parsedData[prop] = parseTimestamp(data[prop]);
    }
  }

  if (data.latestVersion != null)
    parsedData.latestVersion = parseCandidateVersion(data.latestVersion, {
      chainId,
    });

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.versions != null)
    parsedData.versions = data.versions.map((v) =>
      parseCandidateVersion(v, { chainId }),
    );

  return parsedData;
};

const parseDelegate = (data) => {
  const parsedData = { ...data };

  parsedData.delegatedVotes = parseInt(data.delegatedVotes);

  parsedData.nounsRepresented = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nounsRepresented
      .map((n) => {
        const noun = { ...n };
        if (n.seed != null)
          noun.seed = objectUtils.mapValues((v) => parseInt(v), n.seed);
        if (n.owner != null) {
          noun.ownerId = n.owner?.id;
          noun.delegateId = n.owner?.delegate?.id;
        }
        return noun;
      })
      // Don’t include nouns delegated to other accounts
      .filter((n) => n.delegateId == null || n.delegateId === data.id),
  );

  if (data.votes != null) parsedData.votes = data.votes.map(parseProposalVote);

  if (data.proposals != null)
    parsedData.proposals = data.proposals.map(parseProposal);

  return parsedData;
};

const parseAccount = (data) => {
  const parsedData = { ...data };

  parsedData.nouns = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nouns.map((n) => ({
      ...n,
      seed: objectUtils.mapValues((v) => parseInt(v), n.seed),
      ownerId: n.owner?.id,
      delegateId: n.owner?.delegate?.id,
    })),
  );

  parsedData.delegateId = data.delegate?.id;
  return parsedData;
};

const parseNoun = (data) => {
  const parsedData = { ...data };

  parsedData.seed = objectUtils.mapValues((v) => parseInt(v), data.seed);
  parsedData.ownerId = data.owner?.id;
  parsedData.delegateId = data.owner.delegate?.id;

  return parsedData;
};

const parseEvents = (data, accountId) => {
  const transferEvents = data.transferEvents.map((e) => ({
    ...e,
    blockTimestamp: parseTimestamp(e.blockTimestamp),
    accountRef: accountId?.toLowerCase(),
    newAccountId: e.newHolder?.id,
    previousAccountId: e.previousHolder?.id,
    nounId: e.noun?.id,
    type: "transfer",
  }));

  const delegationEvents = data.delegationEvents.map((e) => ({
    ...e,
    blockTimestamp: parseTimestamp(e.blockTimestamp),
    accountRef: accountId?.toLowerCase(),
    delegatorId: e.delegator?.id,
    newAccountId: e.newDelegate?.id,
    previousAccountId: e.previousDelegate?.id,
    nounId: e.noun?.id,
    type: "delegate",
  }));

  return [...transferEvents, ...delegationEvents];
};

export const fetchProposalsVersions = async (chainId, proposalIds) =>
  subgraphFetch({
    chainId,
    query: createProposalsVersionsQuery(proposalIds),
  }).then((data) => {
    if (data.proposalVersions == null)
      return [] /*Promise.reject(new Error("not-found"))*/;
    return data.proposalVersions.map(parseProposalVersion);
  });

export const fetchProposals = async (chainId, proposalIds) => {
  if (!proposalIds || proposalIds.length == 0) return [];
  return subgraphFetch({
    chainId,
    query: createProposalsQuery(proposalIds),
  }).then((data) => {
    return data.proposals.map((p) => parseProposal(p, { chainId }));
  });
};

export const fetchActiveProposals = async (chainId, currentBlock) => {
  return subgraphFetch({
    chainId,
    query: createActiveProposalQuery(currentBlock),
  }).then((data) => {
    return data.proposals.map((p) => parseProposal(p, { chainId }));
  });
};

export const fetchProposalCandidates = async (chainId, candidateIds) => {
  if (!candidateIds || candidateIds.length == 0) return [];
  return subgraphFetch({
    chainId,
    query: createProposalCandidatesQuery(candidateIds),
  }).then((data) => {
    return data.proposalCandidates.map((c) => parseCandidate(c, { chainId }));
  });
};

export const fetchProposalCandidatesFeedbackPosts = async (
  chainId,
  candidateIds,
) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidateFeedbackPostsByCandidatesQuery(candidateIds),
  }).then((data) => {
    if (data.candidateFeedbacks == null)
      return [] /*Promise.reject(new Error("not-found"))*/;
    return data.candidateFeedbacks.map(parseFeedbackPost);
  });

export const fetchProposal = (chainId, id) =>
  subgraphFetch({ chainId, query: createProposalQuery(id) }).then((data) => {
    if (data.proposal == null) return Promise.reject(new Error("not-found"));
    const candidateId = data.proposal.id /*data.proposalCandidateVersions[0]?.proposal.id*/;
    return parseProposal(
      { ...data.proposal, versions: data.proposalVersions, candidateId },
      { chainId },
    );
  });

export const fetchProposalCandidate = async (chainId, rawId) => {
  const [account, ...slugParts] = rawId.split("-");
  const id = [account.toLowerCase(), ...slugParts].join("-");
  // TODO: merge these queries
  return Promise.all([
    subgraphFetch({
      chainId,
      query: createProposalCandidateQuery(id),
    }).then((data) => {
      return {};
      // eslint-disable-next-line no-unreachable
      if (data.proposalCandidate == null)
        return Promise.reject(new Error("not-found"));
      return data.proposalCandidate;
    }),
    subgraphFetch({
      chainId,
      query: createProposalCandidateFeedbackPostsByCandidateQuery(id),
    }).then((data) => {
      return [];
      // eslint-disable-next-line no-unreachable
      if (data.candidateFeedbacks == null)
        return Promise.reject(new Error("not-found"));
      return data.candidateFeedbacks;
    }),
  ]).then(([candidate, feedbackPosts]) =>
    parseCandidate({ ...candidate, feedbackPosts }, { chainId }),
  );
};

export const fetchDelegates = (chainId, options) =>
  subgraphFetch({
    chainId,
    query: createDelegatesQuery(options),
  }).then((data) => {
    return data.delegates.map(parseDelegate);
  });

export const fetchDelegate = (chainId, id) =>
  subgraphFetch({
    chainId,
    query: createDelegateQuery(id.toLowerCase()),
  }).then((data) => {
    if (data.delegate == null) return Promise.reject(new Error("not-found"));
    return parseDelegate(data.delegate);
  });

export const fetchAccount = (chainId, id) =>
  subgraphFetch({
    chainId,
    query: createAccountQuery(id?.toLowerCase()),
  }).then((data) => {
    if (data.account == null) return Promise.reject(new Error("not-found"));
    const events = parseEvents(data, id);
    const account = parseAccount(data.account);
    return { account, events };
  });

export const fetchProposalCandidatesByAccount = (chainId, accountAddress) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidatesByAccountQuery(accountAddress),
  }).then((data) => {
    return [];
    // eslint-disable-next-line no-unreachable
    const candidates = data.proposalCandidates.map((c) =>
      parseCandidate(c, { chainId }),
    );
    return candidates;
  });

export const fetchBrowseScreenData = (chainId, options) =>
  subgraphFetch({ chainId, query: createBrowseScreenQuery(options) }).then(
    (data) => {
      const proposals = data.proposals.map((p) =>
        parseProposal(p, { chainId }),
      );
      const candidates = [] /*data.proposalCandidates.map((c) =>
        parseCandidate(c, { chainId }),
      );*/
      return { proposals, candidates };
    },
  );

export const fetchBrowseScreenSecondaryData = (chainId, options) =>
  subgraphFetch({
    chainId,
    query: createBrowseScreenSecondaryQuery(options),
  }).then((data) => {
    const proposals = data.proposals.map((p) => parseProposal(p, { chainId }));
    const proposalVersions = [] /*data.proposalVersions.map(parseProposalVersion)*/;
    const candidateVersions = [] /*data.proposalCandidateVersions.map((v) =>
      parseCandidateVersion(v, { chainId }),
    )*/;
    const candidateFeedbacks = [] /*data.candidateFeedbacks.map(parseFeedbackPost)*/;
    return {
      proposals,
      proposalVersions,
      candidateVersions,
      candidateFeedbacks,
    };
  });

export const fetchProposalCandidatesSponsoredByAccount = (
  chainId,
  id,
  options,
) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidateSignaturesByAccountQuery(
      id.toLowerCase(),
      options,
    ),
  })
    .then((data) => {
      return true;
      // Fetch signatures, then content IDs, and finally the candidate versions
      // eslint-disable-next-line no-unreachable
      return arrayUtils.unique(
        data.proposalCandidateSignatures.map((s) => s.content.id),
      );
    })
    .then(async (contentIds) => {
      // eslint-disable-next-line no-unused-vars
      const data = await subgraphFetch({
        chainId,
        query: createProposalCandidateVersionByContentIdsQuery(contentIds),
      });

      const versionIds = [] /*data.proposalCandidateVersions.map((v) => v.id)*/;
      return subgraphFetch({
        chainId,
        query: createProposalCandidateByLatestVersionIdsQuery(versionIds),
      }).then((data) => {
        return [];
        // eslint-disable-next-line no-unreachable
        const candidates = data.proposalCandidates.map((c) =>
          parseCandidate(c, { chainId }),
        );
        return candidates;
      });
    });

export const fetchVoterScreenData = (chainId, id, options) =>
  subgraphFetch({
    chainId,
    query: createVoterScreenQuery(id.toLowerCase(), options),
  }).then((data) => {
    const proposals = data.proposals.map((p) => parseProposal(p, { chainId }));
    const candidates = [] /*data.proposalCandidates.map((c) =>
      parseCandidate(c, { chainId }),
    )*/;
    const votes = data.votes.map(parseProposalVote);
    const proposalFeedbackPosts = [] /*data.proposalFeedbacks.map(parseFeedbackPost)*/;
    const candidateFeedbackPosts =
      [] /*data.candidateFeedbacks.map(parseFeedbackPost)*/;
    const nouns = data.nouns.map(parseNoun);
    const events = parseEvents(data, id);

    return {
      proposals,
      candidates,
      votes,
      proposalFeedbackPosts,
      candidateFeedbackPosts,
      nouns,
      events,
    };
  });

export const fetchNounsActivity = (chainId, { startBlock, endBlock }) =>
  subgraphFetch({
    chainId,
    query: createNounsActivityDataQuery({
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
    }),
  }).then((data) => {
    // if (data.candidateFeedbacks == null)
    //   return Promise.reject(new Error("not-found"));

    const candidateFeedbackPosts =
      [] /*data.candidateFeedbacks.map(parseFeedbackPost)*/;
    const proposalFeedbackPosts = [] /*data.proposalFeedbacks.map(parseFeedbackPost)*/;
    const votes = data.votes
      .map(parseProposalVote)
      .filter((v) => !hideProposalVote(v));

    return { votes, proposalFeedbackPosts, candidateFeedbackPosts };
  });

export const fetchVoterActivity = (
  chainId,
  voterAddress,
  { startBlock, endBlock },
) =>
  subgraphFetch({
    chainId,
    query: createVoterActivityDataQuery(voterAddress?.toLowerCase(), {
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
    }),
  }).then((data) => {
    const candidateFeedbackPosts =
      [] /*data.candidateFeedbacks.map(parseFeedbackPost)*/;
    const proposalFeedbackPosts = [] /*data.proposalFeedbacks.map(parseFeedbackPost)*/;
    const votes = data.votes.map(parseProposalVote);
    const events = parseEvents(data, voterAddress);

    return { votes, proposalFeedbackPosts, candidateFeedbackPosts, events };
  });

export const fetchNounsByIds = (chainId, ids) =>
  subgraphFetch({
    chainId,
    query: createNounsByIdsQuery(ids),
  }).then((data) => {
    const nouns = data.nouns.map(parseNoun);

    const transferEvents = data.transferEvents.map((e) => ({
      ...e,
      blockTimestamp: parseTimestamp(e.blockTimestamp),
      newAccountId: e.newHolder?.id,
      previousAccountId: e.previousHolder?.id,
      nounId: e.noun?.id,
      type: "transfer",
    }));

    const delegationEvents = data.delegationEvents.map((e) => ({
      ...e,
      blockTimestamp: parseTimestamp(e.blockTimestamp),
      newAccountId: e.newDelegate?.id,
      previousAccountId: e.previousDelegate?.id,
      nounId: e.noun?.id,
      type: "delegate",
    }));

    const auctions = data.auctions.map((a) => ({
      ...a,
      startTime: parseTimestamp(a.startTime),
    }));

    const getEventScore = (event) => {
      // delegate events should come after transfers chronologically
      if (event.type === "transfer") return 0;
      if (event.type === "delegate") return 1;
      else return -1;
    };

    const sortedEvents = arrayUtils.sortBy(
      { value: (e) => e.blockTimestamp, order: "desc" },
      { value: (e) => getEventScore(e), order: "desc" },
      [...transferEvents, ...delegationEvents],
    );

    return { nouns, events: sortedEvents, auctions };
  });
