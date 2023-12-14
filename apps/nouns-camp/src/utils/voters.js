import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildProposalFeed } from "./proposals.js";
import { resolveIdentifier } from "../contracts.js";

export const buildNounsFeed = (noun, { chainId }) => {
  if (noun == null) return [];

  const nounId = noun.id;

  const fromAuctionHouse = (e) =>
    e.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house")?.address?.toLowerCase();

  const toAuctionHouse = (e) =>
    e.newAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house")?.address?.toLowerCase();

  const fromTreasury = (e) =>
    e.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "executor")?.address?.toLowerCase();

  const auctionBoughtEventItems =
    noun.events
      ?.filter((e) => e.type === "transfer" && fromAuctionHouse(e))
      .map((e) => ({
        type: "event",
        eventType: "noun-auction-bought",
        id: `${nounId}-auction-bought-${e.id}`,
        timestamp: e.blockTimestamp,
        blockNumber: e.blockNumber,
        nounId,
        authorAccount: e.newAccountId,
      })) ?? [];

  const delegatedEventItems =
    noun.events
      ?.filter(
        (e) =>
          e.type === "delegate" &&
          !fromAuctionHouse(e) &&
          !toAuctionHouse(e) &&
          !fromTreasury(e) &&
          noun.ownerId.toLowerCase() !== e.newAccountId.toLowerCase()
      )
      .map((e) => ({
        type: "event",
        eventType: "noun-delegated",
        id: `${nounId}-delegated-${e.id}`,
        timestamp: e.blockTimestamp,
        blockNumber: e.blockNumber,
        nounId,
        authorAccount: noun.ownerId,
        fromAccount: e.previousAccountId,
        toAccount: e.newAccountId,
      })) ?? [];

  const transferredEventItems =
    noun.events
      ?.filter(
        (e) =>
          e.type === "transfer" &&
          !fromAuctionHouse(e) &&
          !fromTreasury(e) &&
          !toAuctionHouse(e)
      )
      .map((e) => ({
        type: "event",
        eventType: "noun-transferred",
        id: `${nounId}-transferred-${e.id}`,
        timestamp: e.blockTimestamp,
        blockNumber: e.blockNumber,
        nounId,
        authorAccount: noun.ownerId,
        fromAccount: e.previousAccountId,
        toAccount: e.newAccountId,
      })) ?? [];

  const getEventScore = (event) => {
    if (event.eventType === "noun-transferred") return 0;
    if (event.eventType === "noun-delegated") return 1;
    else return -1;
  };

  return arrayUtils.sortBy(
    { value: (e) => e.blockNumber, order: "desc" },
    { value: (e) => getEventScore(e), order: "desc" },
    [
      ...transferredEventItems,
      ...delegatedEventItems,
      ...auctionBoughtEventItems,
    ]
  );
};

export const buildFeed = (
  delegate,
  { proposals, candidates, nouns, chainId }
) => {
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
      ?.map((c) => buildCandidateFeed(c))
      .flat()
      .filter(
        (i) => i.authorAccount?.toLowerCase() === delegate.id.toLowerCase()
      ) ?? [];

  const nounFeedItems =
    nouns
      ?.map((n) => buildNounsFeed(n, { chainId }))
      .flat()
      .filter(
        (i) =>
          i.authorAccount?.toLowerCase() === delegate.id.toLowerCase() ||
          i.toAccount?.toLowerCase() === delegate.id.toLowerCase() ||
          i.fromAccount?.toLowerCase() === delegate.id.toLowerCase()
      ) ?? [];

  const items = [...propFeedItems, ...candidateFeedItems, ...nounFeedItems];

  return arrayUtils.sortBy({ value: (i) => i.timestamp, order: "desc" }, items);
};
