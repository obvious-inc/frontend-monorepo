import { array as arrayUtils } from "@shades/common/utils";

export const buildFeed = (delegate, { latestBlockNumber, voterAddress }) => {
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

  const items = [...voteItems];

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );
};
