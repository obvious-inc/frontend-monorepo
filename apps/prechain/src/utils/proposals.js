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
