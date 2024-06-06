import { getReposts, stripReposts } from "./markdown.js";

export const EXECUTION_GRACE_PERIOD_IN_MILLIS = 1000 * 60 * 60 * 24 * 21; // 21 days

const isDefeated = (proposal) =>
  proposal.forVotes <= proposal.againstVotes ||
  proposal.forVotes < proposal.quorumVotes;

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

  if (blockNumber == null) return null;

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
