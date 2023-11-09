import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildProposalFeed } from "./proposals.js";

export const buildFeed = (delegate, { proposals, candidates }) => {
  if (delegate == null) return [];

  const propFeedItems =
    proposals
      ?.map((p) => buildProposalFeed(p, {}))
      .flat()
      .filter(
        (p) => p.authorAccount?.toLowerCase() === delegate.id.toLowerCase()
      ) ?? [];

  const candidateFeedItems =
    candidates
      ?.map((c) => buildCandidateFeed(c, { skipSignatures: false }))
      .flat()
      .filter(
        (i) => i.authorAccount?.toLowerCase() === delegate.id.toLowerCase()
      ) ?? [];

  const items = [...propFeedItems, ...candidateFeedItems];

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );
};
