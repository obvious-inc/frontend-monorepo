import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildProposalFeed } from "./proposals.js";
import { resolveIdentifier } from "../contracts.js";

const buildEventsFeed = (delegate, account) => {
  if (account == null) return [];

  const fromAuctionHouse = (e) =>
    e.previousAccountId === resolveIdentifier("auction-house").address;

  const toAuctionHouse = (e) =>
    e.newAccountId === resolveIdentifier("auction-house").address;

  const events = account.events ?? [];

  // transfer events always come with an associated delegate event, ignore the latter
  const uniqueEvents = arrayUtils.unique(
    (e1, e2) => e1.id === e2.id,
    // transfer events have to be first here to take precedence
    arrayUtils.sortBy(
      { value: (e) => e.type === "transfer", order: "asc" },
      events,
    ),
  );

  const auctionBoughtEventItems = uniqueEvents
    .filter((e) => e.type === "transfer" && fromAuctionHouse(e))
    .map((e) => ({
      type: "noun-auction-bought",
      id: `${e.nounId}-auction-bought-${e.id}`,
      timestamp: e.blockTimestamp,
      blockNumber: e.blockNumber,
      nounId: e.nounId,
      authorAccount: e.newAccountId,
      fromAccount: e.previousAccountId,
      toAccount: e.newAccountId,
      transactionHash: e.id.split("_")[0],
    }));

  const delegatedEventItems = uniqueEvents
    .filter((e) => e.type === "delegate" && !fromAuctionHouse(e))
    .map((e) => {
      const eventType =
        delegate?.id === e.previousAccountId && delegate?.id !== e.delegatorId
          ? "noun-undelegated"
          : "noun-delegated";
      return {
        type: eventType,
        id: `${e.nounId}-delegated-${e.id}`,
        timestamp: e.blockTimestamp,
        blockNumber: e.blockNumber,
        nounId: e.nounId,
        authorAccount: e.delegatorId,
        fromAccount: e.previousAccountId,
        toAccount: e.newAccountId,
        transactionHash: e.id.split("_")[0],
      };
    });

  const transferredEventItems = uniqueEvents
    .filter(
      (e) =>
        e.type === "transfer" && !fromAuctionHouse(e) && !toAuctionHouse(e),
    )
    .map((e) => ({
      type: "noun-transferred",
      id: `${e.nounId}-transferred-${e.id}`,
      timestamp: e.blockTimestamp,
      blockNumber: e.blockNumber,
      nounId: e.nounId,
      authorAccount: e.previousAccountId,
      fromAccount: e.previousAccountId,
      toAccount: e.newAccountId,
      transactionHash: e.id.split("_")[0],
      accountRef: delegate?.id,
    }));

  const groupedAllEventItems = arrayUtils.groupBy(
    (e) => `${e.transactionHash}-${e.type}-${e.fromAccount}-${e.toAccount}`,
    [
      ...delegatedEventItems,
      ...transferredEventItems,
      ...auctionBoughtEventItems,
    ],
  );

  const allEventItems = Object.values(groupedAllEventItems).map((group) => {
    const lastEvent = group[group.length - 1];
    return {
      ...lastEvent,
      id: `${lastEvent.blockNumber}-${lastEvent.transactionHash}-${lastEvent.type}-${lastEvent.fromAccount}-${lastEvent.toAccount}`,
      nouns: group.map((e) => e.nounId),
    };
  });

  return allEventItems;
};

export const buildFeed = (delegate, { proposals, candidates, account }) => {
  if (delegate == null) return [];

  const propFeedItems =
    proposals
      ?.map((p) => buildProposalFeed(p, {}))
      .flat()
      .filter(
        (p) => p.authorAccount?.toLowerCase() === delegate?.id.toLowerCase(),
      ) ?? [];

  const candidateFeedItems =
    candidates
      ?.map((c) => buildCandidateFeed(c))
      .flat()
      .filter(
        (i) => i.authorAccount?.toLowerCase() === delegate?.id.toLowerCase(),
      ) ?? [];

  const eventItems = buildEventsFeed(delegate, account).flat() ?? [];

  const items = [...propFeedItems, ...candidateFeedItems, ...eventItems];
  return arrayUtils.sortBy({ value: (i) => i.timestamp, order: "desc" }, items);
};
