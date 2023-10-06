import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";

const EXECUTION_GRACE_PERIOD_IN_MILLIS = 1000 * 60 * 60 * 24 * 21; // 21 days

const isDefeated = (proposal) =>
  Number(proposal.forVotes) <= Number(proposal.againstVotes) ||
  Number(proposal.forVotes) < Number(proposal.quorumVotes);

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

  if (proposal.executionETA === null) return "succeeded"; // Not yet queued

  if (
    new Date().getTime() >=
    Number(proposal.executionETA) * 1000 + EXECUTION_GRACE_PERIOD_IN_MILLIS
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

export const buildFeed = (proposal, { latestBlockNumber, candidate }) => {
  if (proposal == null) return [];

  const candidateItems =
    candidate == null
      ? []
      : buildCandidateFeed(candidate, { skipSignatures: true });

  const createdEventItem = {
    type: "event",
    eventType: "proposal-created",
    id: `${proposal.id}-created`,
    timestamp: proposal.createdTimestamp,
    blockNumber: proposal.createdBlock,
    authorAccount: proposal.proposerId,
    proposalId: proposal.id,
  };

  const feedbackPostItems =
    proposal.feedbackPosts?.map((p) => ({
      type: "feedback-post",
      id: `${proposal.id}-${p.id}`,
      body: p.reason,
      support: p.supportDetailed,
      authorAccount: p.voter.id,
      timestamp: p.createdTimestamp,
      blockNumber: p.createdBlock,
      voteCount: p.votes,
      proposalId: proposal.id,
    })) ?? [];

  const voteItems =
    proposal.votes?.map((v) => ({
      type: "vote",
      id: `${proposal.id}-${v.id}`,
      body: v.reason,
      support: v.supportDetailed,
      authorAccount: v.voter.id,
      blockNumber: v.blockNumber,
      voteCount: v.votes,
      proposalId: proposal.id,
    })) ?? [];

  const propdateItems =
    proposal.propdates?.map((p) => ({
      type: "event",
      eventType: p.markedCompleted
        ? "propdate-marked-completed"
        : "propdate-posted",
      id: `propdate-${p.id}`,
      body: p.update,
      blockNumber: p.blockNumber,
      timestamp: p.blockTimestamp,
      proposalId: proposal.id,
    })) ?? [];

  const updateEventItems =
    proposal.versions?.map((v) => ({
      type: "event",
      eventType: "proposal-updated",
      id: `proposal-update-${v.createdBlock}`,
      body: v.updateMessage,
      blockNumber: v.createdBlock,
      timestamp: v.createdTimestamp,
      proposalId: proposal.id,
    })) ?? [];

  const items = [
    ...candidateItems,
    ...feedbackPostItems,
    ...voteItems,
    ...propdateItems,
    ...updateEventItems,
    createdEventItem,
  ];

  if (proposal.state === "canceled")
    return arrayUtils.sortBy(
      { value: (i) => i.blockNumber, order: "desc" },
      items
    );

  if (latestBlockNumber > proposal.startBlock) {
    items.push({
      type: "event",
      eventType: "proposal-started",
      id: `${proposal.id}-started`,
      blockNumber: proposal.startBlock,
      proposalId: proposal.id,
    });
  }

  const actualEndBlock = proposal.objectionPeriodEndBlock ?? proposal.endBlock;

  if (latestBlockNumber > actualEndBlock) {
    items.push({
      type: "event",
      eventType: "proposal-ended",
      id: `${proposal.id}-ended`,
      blockNumber: actualEndBlock,
      proposalId: proposal.id,
    });
  }

  if (proposal.objectionPeriodEndBlock != null) {
    items.push({
      type: "event",
      eventType: "proposal-objection-period-started",
      id: `${proposal.id}-objection-period-start`,
      blockNumber: proposal.endBlock,
      proposalId: proposal.id,
    });
  }

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );
};
