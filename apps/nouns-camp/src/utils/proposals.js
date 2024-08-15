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
    case "executed": {
      return state[0].toUpperCase() + state.slice(1);
    }

    default:
      throw new Error(`Unknown state "${state}"`);
  }
};

export const getLatestVersionBlock = (proposal) => {
  if (!proposal.versions) return null;

  // sort prop versions by createdBlock descending
  const sortedVersions = proposal.versions.sort(
    (a, b) => Number(b.createdBlock) - Number(a.createdBlock),
  );

  return sortedVersions[0].createdBlock;
};

export const getForYouGroup = ({ connectedAccountAddress }, p) => {
  if (["pending", "updatable"].includes(p.state)) return "new";
  if (isFinalState(p.state) || isSucceededState(p.state)) return "past";

  if (connectedAccountAddress == null) return "ongoing";

  if (
    p.proposerId === connectedAccountAddress ||
    p.signers?.some((s) => s.id === connectedAccountAddress)
  )
    return "authored";

  if (
    isVotableState(p.state) &&
    p.votes != null &&
    !p.votes.some((v) => v.voterId === connectedAccountAddress)
  )
    return "awaiting-vote";

  return "ongoing";
};
