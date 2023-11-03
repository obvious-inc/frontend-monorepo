import { array as arrayUtils } from "@shades/common/utils";

export const buildFeed = (delegate, candidates) => {
  if (delegate == null) return [];

  const voteItems =
    delegate.votes?.map((v) => ({
      type: "vote",
      id: `${delegate.id}-${v.id}`,
      body: v.reason,
      support: v.support,
      authorAccount: v.voterId,
      blockNumber: v.createdBlock,
      timestamp: v.createdTimestamp,
      voteCount: v.votes,
      proposalId: v.proposalId,
      isPending: v.isPending,
    })) ?? [];

  const proposalItems =
    delegate.proposals?.map((proposal) => ({
      type: "event",
      eventType: "proposal-created",
      id: `${proposal.id}-created`,
      timestamp: proposal.createdTimestamp,
      blockNumber: proposal.createdBlock,
      authorAccount: proposal.proposerId,
      proposalId: proposal.id,
    })) ?? [];

  const candidateItems = candidates?.map((candidate) => ({
    type: "event",
    eventType: "candidate-created",
    id: `${candidate.id}-created`,
    timestamp: candidate.createdTimestamp,
    blockNumber: candidate.createdBlock,
    authorAccount: candidate.proposerId,
    candidateId: candidate.id,
    targetProposalId: candidate.proposalId,
  }));

  const items = [...voteItems, ...proposalItems, ...candidateItems];

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );
};
