import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { parse as parseTransactions } from "./utils/transactions.js";

const customSubgraphEndpoint =
  typeof location === "undefined"
    ? null
    : new URLSearchParams(location.search).get("nouns-subgraph");

const SERVER_URL = process.env.NOUNS_SUBGRAPH_URL;
const CLIENT_URL = "/subgraphs/nouns";

const parseTimestamp = (unixSeconds) => new Date(parseInt(unixSeconds) * 1000);

const VOTE_FIELDS = `
  fragment VoteFields on Vote {
    id
    blockNumber
    blockTimestamp
    reason
    supportDetailed
    votes
    voter { id }
    proposal { id }
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
      nounsRepresented { id }
    }
    candidate { id }
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
      nounsRepresented { id }
    }
    proposal { id }
  }`;

const FULL_PROPOSAL_FIELDS = `
  ${VOTE_FIELDS}
  ${PROPOSAL_FEEDBACK_FIELDS}
  fragment FullProposalFields on Proposal {
    id
    status
    title
    description
    createdBlock
    createdTimestamp
    lastUpdatedBlock
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    canceledBlock
    canceledTimestamp
    queuedBlock
    queuedTimestamp
    executedBlock
    executedTimestamp
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    abstainVotes
    executionETA
    quorumVotes
    proposer { id }
    signers { id }
    votes { ...VoteFields }
    feedbackPosts { ...ProposalFeedbackFields }
  }`;

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
      nounsRepresented { id }
    }
    content { id }
  }`;

const DELEGATION_EVENT_FIELDS = `
  fragment DelegationEventFields on DelegationEvent {
    id
    noun { id }
    newDelegate { id }
    previousDelegate { id }
    delegator { id }
    blockNumber
    blockTimestamp
  }`;

const TRANSFER_EVENT_FIELDS = `
  fragment TransferEventFields on TransferEvent {
    id
    noun { id }
    newHolder { id }
    previousHolder { id }
    blockNumber
    blockTimestamp
  }`;

export const subgraphFetch = async ({
  endpoint,
  operationName,
  query,
  variables,
}) => {
  const url = (() => {
    if (endpoint != null) return endpoint;
    if (customSubgraphEndpoint != null) return customSubgraphEndpoint;
    if (typeof window === "undefined") return SERVER_URL;
    return CLIENT_URL;
  })();

  if (url == null) throw new Error();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName, query, variables }),
  });
  if (!response.ok) return Promise.reject(new Error(response.statusText));
  const body = await response.json();
  if (body.errors != null) {
    console.error("Unexpected subgraph response", body);
    return Promise.reject(new Error("subgraph-error"));
  }
  return body.data;
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

export const parseProposal = (data) => {
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

  if (data.targets != null) parsedData.transactions = parseTransactions(data);

  return parsedData;
};

// Hide proposal votes from 0 voting power account if no reason is given
const hideProposalVote = (v) =>
  v.votes === 0 && (v.reason?.trim() ?? "") === "";

const parseCandidateVersion = (v) => {
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
    parsedVersion.content.transactions = parseTransactions(v.content);

  if (v.proposal != null) parsedVersion.candidateId = v.proposal.id;

  return parsedVersion;
};

export const parseCandidate = (data) => {
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
      parsedData[prop] = parseTimestamp(data[prop]);
    }
  }

  if (data.latestVersion != null)
    parsedData.latestVersion = parseCandidateVersion(data.latestVersion);

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.versions != null)
    parsedData.versions = data.versions.map(parseCandidateVersion);

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

const parseTransferEvent = (e) => ({
  ...e,
  blockTimestamp: parseTimestamp(e.blockTimestamp),
  newAccountId: e.newHolder?.id,
  previousAccountId: e.previousHolder?.id,
  nounId: e.noun?.id,
  type: "transfer",
});

const parseDelegationEvent = (e) => ({
  ...e,
  blockTimestamp: parseTimestamp(e.blockTimestamp),
  delegatorId: e.delegator?.id,
  newAccountId: e.newDelegate?.id,
  previousAccountId: e.previousDelegate?.id,
  nounId: e.noun?.id,
  type: "delegate",
});

export const fetchProposalsVersions = async (proposalIds) => {
  const data = await subgraphFetch({
    query: `{
      proposalVersions(
        where: {
          proposal_in: [${proposalIds.map((id) => `"${id}"`)}]
        }
      ) {
        createdAt
        createdBlock
        updateMessage
        proposal { id }
      }
    }`,
  });
  if (data.proposalVersions == null)
    return Promise.reject(new Error("not-found"));
  return data.proposalVersions.map(parseProposalVersion);
};

export const fetchProposals = async (proposalIds) => {
  if (!proposalIds || proposalIds.length == 0) return [];
  const data = await subgraphFetch({
    query: `
      ${FULL_PROPOSAL_FIELDS}
      query {
        proposals(
          where: {
            id_in: [${proposalIds.map((id) => `"${id}"`)}]
          }
        ) {
          ...FullProposalFields
        }
      }`,
  });
  return data.proposals.map((p) => parseProposal(p));
};

export const fetchActiveProposals = async (currentBlock) => {
  const data = await subgraphFetch({
    query: `
      ${FULL_PROPOSAL_FIELDS}
      query {
        proposals(
          where: {
            and: [
              { status_not_in: ["CANCELLED", "VETOED"] },
              {
                or: [
                  { endBlock_gt: ${currentBlock} },
                  { objectionPeriodEndBlock_gt: ${currentBlock} }
                ]
              }
            ]
          }
        ) {
          ...FullProposalFields
        }
      }`,
  });
  return data.proposals.map((p) => parseProposal(p));
};

export const fetchProposalCandidates = async (candidateIds) => {
  if (!candidateIds || candidateIds.length == 0) return [];
  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
      query {
        proposalCandidates(
          where: {
            id_in: [${candidateIds.map((id) => JSON.stringify(id))}]
          }
        ) {
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
      }`,
  });
  return data.proposalCandidates.map(parseCandidate);
};

export const fetchCandidatesFeedbackPosts = async (candidateIds) => {
  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_FEEDBACK_FIELDS}
      query {
        candidateFeedbacks(
          where: {
            candidate_in: [${candidateIds.map((id) => JSON.stringify(id))}]
          },
          first: 1000
        ) {
          ...CandidateFeedbackFields
        }
      }`,
  });
  if (data.candidateFeedbacks == null)
    return Promise.reject(new Error("not-found"));
  return data.candidateFeedbacks.map(parseFeedbackPost);
};

export const fetchProposal = async (id) => {
  const data = await subgraphFetch({
    query: `
      ${FULL_PROPOSAL_FIELDS}
      query {
        proposal(id: "${id}") {
          ...FullProposalFields
        }

        proposalVersions(where: {proposal: "${id}"}) {
          createdAt
          createdBlock
          updateMessage
        }

        proposalCandidateVersions(
          where: {
            content_: {
              matchingProposalIds_contains: ["${id}"]
            }
          }
        ) {
          createdBlock
          createdTimestamp
          updateMessage
          proposal { id }
        }
      }`,
  });

  if (data.proposal == null) return Promise.reject(new Error("not-found"));

  const candidateId = data.proposalCandidateVersions[0]?.proposal.id;

  return parseProposal({
    ...data.proposal,
    versions: data.proposalVersions,
    candidateId,
  });
};

export const fetchProposalCandidate = async (rawId) => {
  const [account, ...slugParts] = rawId.split("-");
  const id = [account.toLowerCase(), ...slugParts].join("-");
  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
      ${CANDIDATE_FEEDBACK_FIELDS}
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

        candidateFeedbacks(
          where: {
            candidate_: { id: ${JSON.stringify(id)} }
          }
        ) {
          ...CandidateFeedbackFields
        }
      }`,
  });

  if (data.proposalCandidate == null)
    return Promise.reject(new Error("not-found"));

  return parseCandidate({
    ...data.proposalCandidate,
    feedbackPosts: data.candidateFeedbacks,
  });
};

export const fetchDelegates = async ({
  includeVotes = false,
  includeZeroVotingPower = false,
}) => {
  const { delegates } = await subgraphFetch({
    query: `
      query {
        delegates(
          first: 1000
          ${
            !includeZeroVotingPower
              ? ", where: { nounsRepresented_: {} }"
              : ", where: { votes_: {} }"
          }
        ) {
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
              delegate { id }
            }
          }
        }
      }`,
  });
  return delegates.map(parseDelegate);
};

export const fetchDelegate = async (id) => {
  const { delegate } = await subgraphFetch({
    query: `
      ${VOTE_FIELDS}
      query {
        delegate(id: "${id.toLowerCase()}") {
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
              delegate { id }
            }
          }
          votes(first: 1000, orderBy: blockNumber, orderDirection: desc) {
            ...VoteFields
          }
          proposals(first: 1000, orderBy: createdBlock, orderDirection: desc) {
            id
            description
            title
            status
            createdBlock
            createdTimestamp
            lastUpdatedBlock
            lastUpdatedTimestamp
            startBlock
            endBlock
            updatePeriodEndBlock
            objectionPeriodEndBlock
            canceledBlock
            canceledTimestamp
            queuedBlock
            queuedTimestamp
            executedBlock
            executedTimestamp
            forVotes
            againstVotes
            abstainVotes
            quorumVotes
            executionETA
            proposer { id }
          }
        }
    }`,
  });

  if (delegate == null) return Promise.reject(new Error("not-found"));
  return parseDelegate(delegate);
};

export const fetchAccount = async (id) => {
  const { account, transferEvents, delegationEvents } = await subgraphFetch({
    query: `
      ${DELEGATION_EVENT_FIELDS}
      ${TRANSFER_EVENT_FIELDS}
      query {
        account(id: "${id.toLowerCase()}") {
          id
          delegate { id }
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
              delegate { id }
            }
          }
        }
        transferEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          where: {
            or: [
              { newHolder: "${id}" },
              { previousHolder: "${id}" }
            ]
          }
        ) {
          ...TransferEventFields
        }
        delegationEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          where: {
            or: [
              { newDelegate: "${id}" },
              { previousDelegate: "${id}" },
              { delegator: "${id}" }
            ]
          }
        ) {
          ...DelegationEventFields
        }
      }
    `,
  });
  if (account == null) return Promise.reject(new Error("not-found"));
  return {
    account: parseAccount(account),
    transferEvents: transferEvents.map(parseTransferEvent),
    delegationEvents: delegationEvents.map(parseDelegationEvent),
  };
};

export const fetchProposalCandidatesByAccount = async (accountAddress) => {
  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
      query {
        proposalCandidates(
          where: { proposer: "${accountAddress}" }
        ) {
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
      }`,
  });
  const candidates = data.proposalCandidates.map(parseCandidate);
  return candidates;
};

export const fetchBrowseScreenData = async ({
  skip = 0,
  first = 1000,
} = {}) => {
  const data = await subgraphFetch({
    query: `
    ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
    query {
      proposals(
        orderBy: createdBlock,
        orderDirection: desc,
        skip: ${skip},
        first: ${first}
      ) {
        id
        title
        status
        createdBlock
        createdTimestamp
        lastUpdatedBlock
        lastUpdatedTimestamp
        startBlock
        endBlock
        updatePeriodEndBlock
        objectionPeriodEndBlock
        canceledBlock
        canceledTimestamp
        queuedBlock
        queuedTimestamp
        executedBlock
        executedTimestamp
        forVotes
        againstVotes
        abstainVotes
        quorumVotes
        executionETA
        proposer { id }
        signers { id }
      }
      proposalCandidates(
        orderBy: createdBlock,
        orderDirection: desc,
        skip: ${skip},
        first: ${first}
      ) {
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
    }`,
  });

  const proposals = data.proposals.map(parseProposal);
  const candidates = data.proposalCandidates.map(parseCandidate);
  return { proposals, candidates };
};

export const fetchBrowseScreenSecondaryData = async ({
  proposalIds,
  candidateIds,
}) => {
  const data = await subgraphFetch({
    // TODO: proposal feedbacks
    query: `
      ${VOTE_FIELDS}
      ${CANDIDATE_FEEDBACK_FIELDS}
      query {
        proposals(
          where: {
            id_in: [${proposalIds.map((id) => `"${id}"`)}]
          }
        ) {
          id
          votes { ...VoteFields }
        }

        proposalVersions(
          where: {
            proposal_in: [${proposalIds.map((id) => `"${id}"`)}]
          }
        ) {
          createdAt
          createdBlock
          updateMessage
          proposal { id }
        }

        proposalCandidateVersions(
          where: {
            proposal_in: [${candidateIds.map((id) => JSON.stringify(id))}]
          }
        ) {
          id
          createdBlock
          createdTimestamp
          updateMessage
          proposal { id }
        }

        candidateFeedbacks(
          where: {
            candidate_in: [${candidateIds.map((id) => JSON.stringify(id))}]
          },
          first: 1000
        ) {
          ...CandidateFeedbackFields
        }
      }`,
  });
  const proposals = data.proposals.map(parseProposal);
  const proposalVersions = data.proposalVersions.map(parseProposalVersion);
  const candidateVersions = data.proposalCandidateVersions.map(
    parseCandidateVersion,
  );
  const candidateFeedbacks = data.candidateFeedbacks.map(parseFeedbackPost);
  return {
    proposals,
    proposalVersions,
    candidateVersions,
    candidateFeedbacks,
  };
};

export const fetchProposalCandidatesSponsoredByAccount = async (
  id,
  { skip = 0, first = 1000 } = {},
) => {
  // Fetch signatures, then content IDs, and finally the candidate versions
  const { proposalCandidateSignatures } = await subgraphFetch({
    query: `
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
      query {
        proposalCandidateSignatures(
          skip: ${skip},
          first: ${first},
          where: { signer: "${id.toLowerCase()}" }
        ) {
          ...CandidateContentSignatureFields
        }
      }`,
  });

  const contentIds = arrayUtils.unique(
    proposalCandidateSignatures.map((s) => s.content.id),
  );

  const { proposalCandidateVersions } = await subgraphFetch({
    query: `
      query {
        proposalCandidateVersions(
          where: {
            content_in: [${contentIds.map((id) => `"${id}"`)}]
          }
        ) {
          id
          createdBlock
          createdTimestamp
          updateMessage
          proposal { id }
          content { id }
        }
      }`,
  });

  const versionIds = proposalCandidateVersions.map((v) => v.id);

  const { proposalCandidates } = await subgraphFetch({
    query: `
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
      query {
        proposalCandidates(
          where: {
            latestVersion_in: [${versionIds.map((id) => `"${id}"`)}]
          }
        ) {
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
          versions { id }
        }
      }`,
  });

  return proposalCandidates.map(parseCandidate);
};

export const fetchVoterScreenData = async (
  id_,
  { skip = 0, first = 1000 } = {},
) => {
  const id = id_.toLowerCase();
  const data = await subgraphFetch({
    query: `
      ${VOTE_FIELDS}
      ${CANDIDATE_FEEDBACK_FIELDS}
      ${PROPOSAL_FEEDBACK_FIELDS}
      ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
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
          lastUpdatedBlock
          lastUpdatedTimestamp
          startBlock
          endBlock
          updatePeriodEndBlock
          objectionPeriodEndBlock
          canceledBlock
          canceledTimestamp
          queuedBlock
          queuedTimestamp
          executedBlock
          executedTimestamp
          forVotes
          againstVotes
          abstainVotes
          quorumVotes
          executionETA
          proposer { id }
          signers { id }
          votes { ...VoteFields }
        }

        proposalCandidates(
          orderBy: createdBlock,
          orderDirection: desc,
          skip: ${skip},
          first: ${first},
          where: { proposer: "${id}" }
        ) {
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
        votes (
          orderBy: blockNumber,
          orderDirection: desc,
          skip: ${skip},
          first: ${first},
          where: { voter: "${id}" }
        ) {
          ...VoteFields
        }
        candidateFeedbacks(
          skip: ${skip},
          first: ${first},
          where: { voter: "${id}" }
        ) {
          ...CandidateFeedbackFields
        }
        proposalFeedbacks(
          skip: ${skip},
          first: ${first},
          where: { voter: "${id}" }
        ) {
          ...ProposalFeedbackFields
        }
        nouns(where: { owner: "${id}" }) {
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
            delegate { id }
          }
        }
        transferEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          skip: ${skip},
          first: ${first},
          where: {
            or: [
              { newHolder: "${id}" },
              { previousHolder: "${id}" }
            ]
          }
        ) {
          ...TransferEventFields
        }
        delegationEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          skip: ${skip},
          first: ${first},
          where: {
            or: [
              { newDelegate: "${id}" },
              { previousDelegate: "${id}" },
              { delegator: "${id}" }
            ]
          }
        ) {
          ...DelegationEventFields
        }
      }`,
  });
  const proposals = data.proposals.map(parseProposal);
  const candidates = data.proposalCandidates.map(parseCandidate);
  const votes = data.votes.map(parseProposalVote);
  const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
  const candidateFeedbackPosts = data.candidateFeedbacks.map(parseFeedbackPost);
  const nouns = data.nouns.map(parseNoun);
  const transferEvents = data.transferEvents.map(parseTransferEvent);
  const delegationEvents = data.delegationEvents.map(parseDelegationEvent);

  return {
    proposals,
    candidates,
    votes,
    proposalFeedbackPosts,
    candidateFeedbackPosts,
    nouns,
    transferEvents,
    delegationEvents,
  };
};

export const fetchNounsActivity = async ({ startBlock, endBlock }) => {
  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_FEEDBACK_FIELDS}
      ${PROPOSAL_FEEDBACK_FIELDS}
      ${VOTE_FIELDS}
      query {
        candidateFeedbacks(
          where: {
            createdBlock_gte: ${startBlock},
            createdBlock_lte: ${endBlock}
          },
          first: 1000
        ) {
          ...CandidateFeedbackFields
        }
        proposalFeedbacks(
          where: {
            createdBlock_gte: ${startBlock},
            createdBlock_lte: ${endBlock}
          },
          first: 1000
        ) {
          ...ProposalFeedbackFields
        }
        votes(
          where: {
            blockNumber_gte: ${startBlock},
            blockNumber_lte: ${endBlock}
          },
          orderBy: blockNumber,
          orderDirection: desc,
          first: 1000
        ) {
          ...VoteFields
          proposal { id }
        }
      }`,
  });

  const candidateFeedbackPosts = data.candidateFeedbacks.map(parseFeedbackPost);
  const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
  // TODO: Move filter close to UI code?
  const votes = data.votes
    .map(parseProposalVote)
    .filter((v) => !hideProposalVote(v));

  return { votes, proposalFeedbackPosts, candidateFeedbackPosts };
};

export const fetchVoterActivity = async (
  voterAddress_,
  { startBlock, endBlock },
) => {
  const voterAddress = voterAddress_.toLowerCase();

  const data = await subgraphFetch({
    query: `
      ${CANDIDATE_FEEDBACK_FIELDS}
      ${PROPOSAL_FEEDBACK_FIELDS}
      ${VOTE_FIELDS}
      ${TRANSFER_EVENT_FIELDS}
      ${DELEGATION_EVENT_FIELDS}
      query {
        candidateFeedbacks(
          where: {
            voter: "${voterAddress}",
            createdBlock_gte: ${startBlock},
            createdBlock_lte: ${endBlock}
          },
          first: 1000
        ) {
          ...CandidateFeedbackFields
        }
        proposalFeedbacks(
          where: {
            voter: "${voterAddress}",
            createdBlock_gte: ${startBlock},
            createdBlock_lte: ${endBlock}
          },
          first: 1000
        ) {
          ...ProposalFeedbackFields
        }
        votes(
          where: {
            voter: "${voterAddress}",
            blockNumber_gte: ${startBlock},
            blockNumber_lte: ${endBlock}
          },
          orderBy: blockNumber,
          orderDirection: desc,
          first: 1000
        ) {
          ...VoteFields
          proposal { id }
        }
        transferEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          first: 1000,
          where: {
            and: [
              {
                blockNumber_gte: ${startBlock},
                blockNumber_lte: ${endBlock}
              },
              {
                or: [
                  { newHolder: "${voterAddress}" },
                  { previousHolder: "${voterAddress}" }
                ]
              }
            ]
          }
        ) {
          ...TransferEventFields
        }
        delegationEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          first: 1000,
          where: {
            and: [
              {
                blockNumber_gte: ${startBlock},
                blockNumber_lte: ${endBlock}
              },
              {
                or: [
                  { newDelegate: "${voterAddress}" },
                  { previousDelegate: "${voterAddress}" },
                  { delegator: "${voterAddress}" }
                ]
              }
            ]
          }
        ) {
          ...DelegationEventFields
        }
      }`,
  });
  const candidateFeedbackPosts = data.candidateFeedbacks.map(parseFeedbackPost);
  const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
  const votes = data.votes.map(parseProposalVote);
  const transferEvents = data.transferEvents.map(parseTransferEvent);
  const delegationEvents = data.delegationEvents.map(parseDelegationEvent);
  return {
    votes,
    proposalFeedbackPosts,
    candidateFeedbackPosts,
    transferEvents,
    delegationEvents,
  };
};

export const fetchNounsByIds = async (ids) => {
  const quotedIds = ids.map((id) => `"${id}"`);
  const data = await subgraphFetch({
    query: `
      ${TRANSFER_EVENT_FIELDS}
      ${DELEGATION_EVENT_FIELDS}
      query {
        nouns(where: { id_in: [${quotedIds}] }) {
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
            delegate { id }
          }
        }
        transferEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          where: { noun_in: [${quotedIds}] }
        ) {
          ...TransferEventFields
        }
        delegationEvents(
          orderBy: blockNumber,
          orderDirection: desc,
          where: { noun_in: [${quotedIds}] }
        ) {
          ...DelegationEventFields
        }
        auctions(where: { noun_in: [${quotedIds}] }) {
          id
          amount
          startTime
        }
      }`,
  });

  const nouns = data.nouns.map(parseNoun);

  const transferEvents = data.transferEvents.map(parseTransferEvent);
  const delegationEvents = data.delegationEvents.map(parseDelegationEvent);

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
};
