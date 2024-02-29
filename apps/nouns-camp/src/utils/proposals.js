import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildPropdateFeed } from "./propdates.js";

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

export const buildFeed = (
  proposal,
  { latestBlockNumber, candidate, includePropdates = true },
) => {
  if (proposal == null) return [];

  const candidateItems = candidate == null ? [] : buildCandidateFeed(candidate);

  const feedbackPostItems =
    proposal.feedbackPosts?.map((p) => ({
      type: "feedback-post",
      id: `${proposal.id}-${p.id}`,
      body: p.reason,
      support: p.support,
      authorAccount: p.voterId,
      timestamp: p.createdTimestamp,
      blockNumber: p.createdBlock,
      voteCount: p.votes,
      proposalId: proposal.id,
      isPending: p.isPending,
    })) ?? [];

  const voteItems =
    proposal.votes?.map((v) => ({
      type: "vote",
      id: `${proposal.id}-${v.id}`,
      body: v.reason,
      support: v.support,
      authorAccount: v.voterId,
      blockNumber: v.createdBlock,
      timestamp: v.createdTimestamp,
      voteCount: v.votes,
      proposalId: proposal.id,
      isPending: v.isPending,
    })) ?? [];

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
    ...feedbackPostItems,
    ...voteItems,
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
