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

export const VOTE_FIELDS = `
  fragment VoteFields on Vote {
    id
    blockNumber
  # blockTimestamp
  # transactionHash
    reason
    supportDetailed
    votes
    voter { id }
    proposal { id }
  }`;

export const CANDIDATE_FEEDBACK_FIELDS = `
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

export const PROPOSAL_FEEDBACK_FIELDS = `
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

export const FULL_PROPOSAL_FIELDS = `
  ${VOTE_FIELDS}
  ${PROPOSAL_FEEDBACK_FIELDS}
  fragment FullProposalFields on Proposal {
    id
    status
    title
    description
    createdBlock
    createdTimestamp
    createdTransactionHash
  # lastUpdatedBlock
  # lastUpdatedTimestamp
    startBlock
    endBlock
  # updatePeriodEndBlock
  # objectionPeriodEndBlock
  # canceledBlock
  # canceledTimestamp
  # canceledTransactionHash
  # queuedBlock
  # queuedTimestamp
  # queuedTransactionHash
  # executedBlock
  # executedTimestamp
  # executedTransactionHash
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    abstainVotes
    executionETA
    quorumVotes
  # adjustedTotalSupply
    proposer { id }
  # signers { id }
    votes { ...VoteFields }
  # feedbackPosts { ...ProposalFeedbackFields }
  }`;

export const CANDIDATE_CONTENT_SIGNATURE_FIELDS = `
  fragment CandidateContentSignatureFields on ProposalCandidateSignature {
    reason
    canceled
    createdBlock
    createdTimestamp
    createdTransactionHash
    expirationTimestamp
    sig
    signer {
      id
      nounsRepresented { id }
    }
    content { id }
  }`;

export const DELEGATION_EVENT_FIELDS = `
  fragment DelegationEventFields on DelegationEvent {
    id
    noun {
      id
      owner { id }
    }
    newDelegate { id }
    previousDelegate { id }
  # delegator { id }
    blockNumber
    blockTimestamp
  }`;

export const TRANSFER_EVENT_FIELDS = `
  fragment TransferEventFields on TransferEvent {
    id
    noun { id }
    newHolder { id }
    previousHolder { id }
    blockNumber
    blockTimestamp
  }`;

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
  // Useful to differentiate feedbacks from votes
  type: "feedback-post",
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: parseTimestamp(post.createdTimestamp),
  createdTransactionHash: post.id.split("-")?.[0],
  reason: post.reason,
  support: post.supportDetailed,
  votes: post.votes == null ? undefined : Number(post.votes),
  voterId: post.voter.id,
  proposalId: post.proposal?.id,
  candidateId: post.candidate?.id,
});

const parseProposalVote = (v) => ({
  id: v.id,
  // Useful to differentiate votes from feedbacks
  type: "vote",
  createdBlock: v.blockNumber == null ? undefined : BigInt(v.blockNumber),
  createdTimestamp:
    v.blockTimestamp == null ? undefined : parseTimestamp(v.blockTimestamp),
  createdTransactionHash: v.transactionHash,
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
  createdTransactionHash: v.createdTransactionHash,
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
  for (const prop of [
    "forVotes",
    "againstVotes",
    "abstainVotes",
    "quorumVotes",
    "adjustedTotalSupply",
  ]) {
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

  if (data.votes != null) parsedData.votes = data.votes.map(parseProposalVote);

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null) parsedData.transactions = parseTransactions(data);

  return parsedData;
};

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

  if (data.delegatedVotes != null)
    parsedData.delegatedVotes = parseInt(data.delegatedVotes);

  if (data.nounsRepresented != null)
    parsedData.nounsRepresented = arrayUtils.sortBy(
      (n) => parseInt(n.id),
      data.nounsRepresented.map(parseNoun),
    );

  if (data.votes != null) parsedData.votes = data.votes.map(parseProposalVote);

  if (data.proposals != null)
    parsedData.proposals = data.proposals.map(parseProposal);

  return parsedData;
};

const parseAccount = (data) => {
  const parsedData = { ...data };

  if (data.nouns != null)
    parsedData.nouns = arrayUtils.sortBy(
      (n) => parseInt(n.id),
      data.nouns.map(parseNoun),
    );

  if (data.delegate?.id != null) parsedData.delegateId = data.delegate.id;

  return parsedData;
};

const parseNoun = (data) => {
  const parsedData = { ...data };

  if (data.seed != null)
    parsedData.seed = objectUtils.mapValues((v) => parseInt(v), data.seed);

  if (data.owner?.id != null) parsedData.ownerId = data.owner.id;

  if (data.owner?.delegate?.id != null)
    parsedData.delegateId = data.owner.delegate.id;

  return parsedData;
};

const parseTransferEvent = (e) => {
  const parsedData = {
    ...e,
    blockTimestamp: parseTimestamp(e.blockTimestamp),
    newAccountId: e.newHolder?.id,
    previousAccountId: e.previousHolder?.id,
    nounId: e.noun?.id,
    type: "transfer",
  };

  if (e.id != null) parsedData.transactionHash = e.id.split("_")[0];

  return parsedData;
};

const parseDelegationEvent = (e) => {
  const parsedData = {
    ...e,
    blockTimestamp: parseTimestamp(e.blockTimestamp),
    delegatorId: e.noun?.owner?.id,
    newAccountId: e.newDelegate?.id,
    previousAccountId: e.previousDelegate?.id,
    nounId: e.noun?.id,
    type: "delegate",
  };

  if (e.id != null) parsedData.transactionHash = e.id.split("_")[0];

  return parsedData;
};

const parseAuction = (a) => {
  const parsedData = { nounId: a.id, ...a };

  if (a.bids != null)
    parsedData.bids = a.bids.map((b) => ({
      id: b.id,
      bidderId: b.bidder.id,
      amount: BigInt(b.amount),
      blockNumber: b.blockNumber == null ? null : BigInt(b.blockNumber),
      blockTimestamp:
        b.blockTimestamp == null ? null : parseTimestamp(b.blockTimestamp),
      transactionHash: b.txHash,
    }));

  if (a.startTime != null)
    parsedData.startTimestamp = parseTimestamp(a.startTime);

  if (a.endTime != null) parsedData.endTimestamp = parseTimestamp(a.endTime);

  return parsedData;
};

export const subgraphFetch = async ({
  endpoint,
  operationName,
  query,
  variables,
}) => {
  const isServer = typeof window === "undefined";

  const url = (() => {
    if (endpoint != null) return endpoint;
    if (customSubgraphEndpoint != null) return customSubgraphEndpoint;
    if (isServer) return SERVER_URL;
    return CLIENT_URL;
  })();

  if (url == null) throw new Error();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName, query, variables }),
    // cache: isServer ? "no-cache" : "default",
  });
  if (!response.ok) {
    console.error("Unsuccessful subgraph request", {
      responseStatus: response.status,
    });
    return Promise.reject(new Error(response.status ?? "No response"));
  }
  const body = await response.json();
  if (body.errors != null) {
    console.error("Unexpected subgraph response", body);
    return Promise.reject(new Error("subgraph-error"));
  }
  return body.data;
};

export const parsedSubgraphFetch = async (options) => {
  const data = await subgraphFetch(options);
  return objectUtils.mapValues((value, key) => {
    switch (key) {
      // Single entities
      case "auction":
      case "account":
      case "delegate":
      case "noun":
      case "proposal":
      case "proposalCandidate": {
        if (value == null) return null;
        const parseFn = {
          auction: parseAuction,
          account: parseAccount,
          delegate: parseDelegate,
          noun: parseNoun,
          proposal: parseProposal,
          proposalCandidate: parseCandidate,
        }[key];
        return parseFn(value);
      }

      // Collections
      case "accounts":
      case "delegates":
      case "nouns":
      case "auctions":
      case "proposals":
      case "proposalVersions":
      case "proposalCandidates":
      case "proposalCandidateVersions":
      case "votes":
      case "proposalFeedbacks":
      case "candidateFeedbacks":
      case "delegationEvents":
      case "transferEvents": {
        const parseFn = {
          accounts: parseAccount,
          delegates: parseDelegate,
          nouns: parseNoun,
          auctions: parseAuction,
          proposals: parseProposal,
          proposalCandidates: parseCandidate,
          proposalVersions: parseProposalVersion,
          proposalCandidateVersions: parseCandidateVersion,
          votes: parseProposalVote,
          proposalFeedbacks: parseFeedbackPost,
          candidateFeedbacks: parseFeedbackPost,
          delegationEvents: parseDelegationEvent,
          transferEvents: parseTransferEvent,
        }[key];
        return value.map(parseFn);
      }

      case "proposalCandidateSignatures":
        // No parsing
        return value;

      default:
        throw new Error(`Unknown subgraph entity "${key}"`);
    }
  }, data);
};
