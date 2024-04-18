import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildPropdateFeed } from "./propdates.js";
import { getReposts, stripReposts } from "./markdown.js";

export const EXECUTION_GRACE_PERIOD_IN_MILLIS = 1000 * 60 * 60 * 24 * 21; // 21 days

const isDefeated = (proposal) =>
  Number(proposal.forVotes) <= Number(proposal.againstVotes) ||
  Number(proposal.forVotes) < Number(proposal.quorumVotes);

export const isExecutable = (proposal, { blockNumber }) => {
  const state = getState(proposal, { blockNumber });
  if (state !== "queued" || proposal.executionEtaTimestamp == null)
    return false;
  return new Date().getTime() >= proposal.executionEtaTimestamp;
};

export const getState = (proposal, { blockNumber }) => {
  if (proposal.status === "VETOED") return "vetoed";
  if (proposal.status === "CANCELLED") return "canceled";
  if (proposal.status === "EXECUTED") return "executed";

  if (blockNumber <= proposal.updatePeriodEndBlock) return "updatable";
  if (blockNumber <= proposal.startBlock) return "pending";
  if (blockNumber <= proposal.endBlock) return "active";
  if (blockNumber <= proposal.objectionPeriodEndBlock)
    return "objection-period";

  if (isDefeated(proposal)) return "defeated";

  if (proposal.executionEtaTimestamp === null) return "succeeded"; // Not yet queued

  if (
    proposal.executionEtaTimestamp != null &&
    new Date().getTime() >=
      proposal.executionEtaTimestamp.getTime() +
        EXECUTION_GRACE_PERIOD_IN_MILLIS
  )
    return "expired";

  return "queued";
};

export const isFinalState = (state) =>
  ["vetoed", "canceled", "defeated", "executed", "expired"].includes(state);

export const isSucceededState = (state) =>
  ["succeeded", "queued", "executed"].includes(state);

export const isVotableState = (state) =>
  ["active", "objection-period"].includes(state);

export const isActiveState = (state) =>
  ["pending", "updatable", "active", "objection-period"].includes(state);

export const extractReposts = (targetPostBody, ascendingPosts) => {
  if (targetPostBody == null || targetPostBody.trim() === "")
    return [[], targetPostBody];

  const repostBodies = getReposts(targetPostBody);
  const repostIndeciesToDrop = [];
  const reposts = repostBodies.reduce((reposts, repostBody, i) => {
    const post = ascendingPosts.find(
      (post) =>
        post.reason != null && post.reason.trim().includes(repostBody.trim()),
    );
    if (post == null) return reposts;
    repostIndeciesToDrop.push(i);
    if (post.type == null) throw new Error('"type" is required');
    return [...reposts, post];
  }, []);
  const strippedReason = stripReposts(targetPostBody, repostIndeciesToDrop);
  return [reposts, strippedReason];
};

const buildVoteAndFeedbackPostFeedItems = ({
  proposalId,
  votes: votes_,
  feedbackPosts: feedbackPosts_,
}) => {
  // Add a "type" since there’s no way to distinguis votes from feedback posts
  const votes = (votes_ ?? []).map((v) => ({ ...v, type: "vote" }));
  const feedbackPosts = (feedbackPosts_ ?? []).map((p) => ({
    ...p,
    type: "feedback-post",
  }));
  const ascendingPosts = arrayUtils.sortBy("createdBlock", [
    ...votes,
    ...feedbackPosts,
  ]);

  return ascendingPosts.map((p) => {
    const postIndex = ascendingPosts.indexOf(p);
    const [reposts, strippedReason] = extractReposts(
      p.reason,
      ascendingPosts.slice(0, postIndex),
    );
    return {
      type: p.type,
      id: p.id,
      support: p.support,
      authorAccount: p.voterId,
      blockNumber: p.createdBlock,
      timestamp: p.createdTimestamp,
      voteCount: p.votes,
      proposalId,
      isPending: p.isPending,
      body: strippedReason,
      reposts: reposts.map((post) => ({
        id: post.id,
        authorAccount: post.voterId,
        body: post.reason,
        type: post.type,
        support: post.support,
      })),
    };
  });
};

export const buildFeed = (
  proposal,
  { latestBlockNumber, candidate, includePropdates = true },
) => {
  if (proposal == null) return [];

  const candidateItems = candidate == null ? [] : buildCandidateFeed(candidate);

  const voteAndFeedbackPostItems = buildVoteAndFeedbackPostFeedItems({
    proposalId: proposal.id,
    votes: proposal.votes,
    feedbackPosts: proposal?.feedbackPosts ?? [],
  });

  const propdateItems =
    !includePropdates || proposal.propdates == null
      ? []
      : buildPropdateFeed(proposal.propdates);

  const updateEventItems =
    proposal.versions
      ?.filter((v) => v.createdBlock > proposal.createdBlock)
      .map((v) => ({
        type: "event",
        eventType: "proposal-updated",
        id: `proposal-update-${v.createdBlock}`,
        body: v.updateMessage,
        blockNumber: v.createdBlock,
        timestamp: v.createdTimestamp,
        proposalId: proposal.id,
        authorAccount: proposal.proposerId, // only proposer can update proposals
      })) ?? [];

  const items = [
    ...candidateItems,
    ...voteAndFeedbackPostItems,
    ...propdateItems,
    ...updateEventItems,
  ];

  if (proposal.createdTimestamp != null)
    items.push({
      type: "event",
      eventType: "proposal-created",
      id: `${proposal.id}-created`,
      timestamp: proposal.createdTimestamp,
      blockNumber: proposal.createdBlock,
      authorAccount: proposal.proposerId,
      proposalId: proposal.id,
    });

  if (proposal.canceledBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-canceled",
      id: `${proposal.id}-canceled`,
      blockNumber: proposal.canceledBlock,
      timestamp: proposal.canceledTimestamp,
      proposalId: proposal.id,
    });

  if (proposal.queuedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-queued",
      id: `${proposal.id}-queued`,
      blockNumber: proposal.queuedBlock,
      timestamp: proposal.queuedTimestamp,
      proposalId: proposal.id,
    });

  if (proposal.executedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-executed",
      id: `${proposal.id}-executed`,
      blockNumber: proposal.executedBlock,
      timestamp: proposal.executedTimestamp,
      proposalId: proposal.id,
    });

  if (
    latestBlockNumber > proposal.startBlock &&
    (proposal.canceledBlock == null ||
      proposal.canceledBlock > proposal.startBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-started",
      id: `${proposal.id}-started`,
      blockNumber: proposal.startBlock,
      proposalId: proposal.id,
    });
  }

  if (
    proposal.objectionPeriodEndBlock != null &&
    (proposal.canceledBlock == null ||
      proposal.canceledBlock > proposal.endBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-objection-period-started",
      id: `${proposal.id}-objection-period-start`,
      blockNumber: proposal.endBlock,
      proposalId: proposal.id,
    });
  }

  const actualEndBlock = proposal.objectionPeriodEndBlock ?? proposal.endBlock;

  if (
    latestBlockNumber > actualEndBlock &&
    (proposal.canceledBlock == null || proposal.canceledBlock > actualEndBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-ended",
      id: `${proposal.id}-ended`,
      blockNumber: actualEndBlock,
      proposalId: proposal.id,
    });
  }

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items,
  );
};

export const getStateLabel = (state) => {
  switch (state) {
    case "updatable":
      return "Open for changes";

    case "pending":
      return "Upcoming";

    case "active":
      return "Ongoing";

    case "objection-period":
      return "Objection period";

    case "queued":
      return "Succeeded";

    case "canceled":
    case "expired":
    case "defeated":
    case "vetoed":
    case "succeeded":
    case "executed":
      return state;

    default:
      throw new Error(`Unknown state "${state}"`);
  }
};
