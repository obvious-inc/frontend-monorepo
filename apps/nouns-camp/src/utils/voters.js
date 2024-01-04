import { array as arrayUtils } from "@shades/common/utils";
import { buildFeed as buildCandidateFeed } from "./candidates.js";
import { buildFeed as buildProposalFeed } from "./proposals.js";
import { resolveIdentifier } from "../contracts.js";

export const buildEventsFeed = (delegate, account, { chainId }) => {
  if (account == null) return [];

  const fromAuctionHouse = (e) =>
    e.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house")?.address?.toLowerCase();

  const toAuctionHouse = (e) =>
    e.newAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house")?.address?.toLowerCase();

  const fromTreasury = (e) =>
    e.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "executor")?.address?.toLowerCase();

  // transfer events always come with an associated delegate event, ignore the latter
  const uniqueEvents = arrayUtils.unique(
    (e1, e2) => {
      if (e1.id === e2.id) return true;
    },
    // transfer events have to be first here to take precedence
    [
      ...account.events.filter((e) => e.type === "transfer"),
      ...account.events.filter((e) => e.type === "delegate"),
    ]
  );

  const auctionBoughtEventItems =
    uniqueEvents
      ?.filter((e) => e.type === "transfer" && fromAuctionHouse(e))
      .map((e) => ({
        type: "noun-auction-bought",
        id: `${e.nounId}-auction-bought-${e.id}`,
        timestamp: e.blockTimestamp,
        blockNumber: e.blockNumber,
        nounId: e.nounId,
        authorAccount: e.newAccountId,
        transactionHash: e.id.split("_")[0],
      })) ?? [];

  const delegatedEventItems =
    uniqueEvents
      ?.filter((e) => e.type === "delegate")
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
        };
      }) ?? [];

  // Group delegated events by block number and new account id
  const groupedDelegatedEventItems = arrayUtils.groupBy(
    (e) => `${e.blockNumber}-${e.toAccount}`,
    delegatedEventItems
  );

  const delegatedEventItemsGrouped = Object.values(
    groupedDelegatedEventItems
  ).map((group) => {
    const lastEvent = group[group.length - 1];
    return {
      ...lastEvent,
      id: `${lastEvent.nounId}-delegated-${lastEvent.blockNumber}`,
      blockNumber: lastEvent.blockNumber,
      timestamp: lastEvent.timestamp,
      transactionHash: lastEvent.transactionHash,
      nouns: group.map((e) => e.nounId),
    };
  });

  const transferredEventItems =
    uniqueEvents
      ?.filter(
        (e) =>
          e.type === "transfer" &&
          !fromAuctionHouse(e) &&
          !fromTreasury(e) &&
          !toAuctionHouse(e)
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
      })) ?? [];

  return [
    ...transferredEventItems,
    ...delegatedEventItemsGrouped,
    ...auctionBoughtEventItems,
  ];
};

export const buildFeed = (
  delegate,
  { proposals, candidates, account, chainId }
) => {
  if (delegate == null) return [];

  const propFeedItems =
    proposals
      ?.map((p) => buildProposalFeed(p, {}))
      .flat()
      .filter(
        (p) => p.authorAccount?.toLowerCase() === delegate?.id.toLowerCase()
      ) ?? [];

  const candidateFeedItems =
    candidates
      ?.map((c) => buildCandidateFeed(c))
      .flat()
      .filter(
        (i) => i.authorAccount?.toLowerCase() === delegate?.id.toLowerCase()
      ) ?? [];

  const eventItems =
    buildEventsFeed(delegate, account, { chainId }).flat() ?? [];

  const items = [...propFeedItems, ...candidateFeedItems, ...eventItems];
  return arrayUtils.sortBy({ value: (i) => i.timestamp, order: "desc" }, items);
};
