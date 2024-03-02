import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildProposalFeed } from "./proposals.js";

export const buildFeed = (accountAddress, { proposals, candidates }) => {
  const propFeedItems =
    proposals
      ?.map((p) => buildProposalFeed(p, {}))
      .flat()
      .filter(
        (p) => p.authorAccount?.toLowerCase() === accountAddress.toLowerCase(),
      ) ?? [];

  const candidateFeedItems =
    candidates
      ?.map((c) => buildCandidateFeed(c))
      .flat()
      .filter(
        (i) => i.authorAccount?.toLowerCase() === accountAddress.toLowerCase(),
      ) ?? [];

  const items = [...propFeedItems, ...candidateFeedItems];

  return arrayUtils.sortBy({ value: (i) => i.timestamp, order: "desc" }, items);
};
