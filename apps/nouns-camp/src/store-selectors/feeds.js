"use client";

import { array as arrayUtils } from "@shades/common/utils";
import { resolveIdentifier } from "../contracts.js";
import {
  createReplyExtractor,
  createRepostExtractor,
} from "../utils/votes-and-feedbacks.js";
import { getSponsorSignatures as getCandidateSponsorSignatures } from "../utils/candidates.js";
import { pickDisplayName as pickFarcasterAccountDisplayName } from "@/utils/farcaster.js";

const createFarcasterCastItem = (cast) => {
  let displayName = pickFarcasterAccountDisplayName(cast.account);

  if (displayName !== cast.account.username)
    displayName += ` (@${cast.account.username})`;

  return {
    type: "farcaster-cast",
    id: cast.hash,
    castHash: cast.hash,
    authorAccount: cast.account.nounerAddress,
    authorFid: cast.account.fid,
    authorAvatarUrl: cast.account.pfpUrl,
    authorDisplayName: displayName,
    authorUsername: cast.account.username,
    body: cast.text,
    timestamp: new Date(cast.timestamp),
  };
};

const buildVoteAndFeedbackPostFeedItems = ({
  proposalId,
  candidateId,
  targetProposalId,
  votes = [],
  feedbackPosts = [],
}) => {
  // Hide proposal votes with 0 voting power account if no reason is given
  const filteredVotes = votes.filter(
    (v) => v.votes > 0 || (v.reason?.trim() ?? "") !== "",
  );
  const filteredFeedbackPosts = feedbackPosts.filter(
    (p) => p.votes > 0 || (p.reason?.trim() ?? "") !== "",
  );
  const ascendingVotesAndFeedbackPosts = arrayUtils.sortBy("createdBlock", [
    ...filteredVotes,
    ...filteredFeedbackPosts,
  ]);

  const items = ascendingVotesAndFeedbackPosts.reduce((acc, p, postIndex) => {
    const previousItems = ascendingVotesAndFeedbackPosts.slice(0, postIndex);
    const extractReplies = createReplyExtractor(previousItems);
    const extractReposts = createRepostExtractor(previousItems);
    const [reposts, reasonWithStrippedReposts] = extractReposts(p.reason);
    const [replies, reasonWithStrippedRepliesAndReposts] = extractReplies(
      reasonWithStrippedReposts,
    );

    const item = {
      id: p.id,
      type: p.type,
      support: p.support,
      authorAccount: p.voterId,
      blockNumber: p.createdBlock,
      timestamp: p.createdTimestamp,
      transactionHash: p.createdTransactionHash,
      voteCount: p.votes,
      isPending: p.isPending,
      body: reasonWithStrippedRepliesAndReposts,
      replies,
      reposts,
      reason: p.reason,
    };

    if (proposalId != null) item.proposalId = proposalId;
    if (targetProposalId != null) item.targetProposalId = targetProposalId;
    if (candidateId != null || p.candidateId != null)
      item.candidateId = candidateId ?? p.candidateId;

    acc.push(item);

    return acc;
  }, []);

  const repostingItemsByTargetFeedItemId = items.reduce((acc, item) => {
    if (item.reposts == null || item.reposts.length === 0) return acc;
    for (const voteOrFeedback of item.reposts) {
      acc[voteOrFeedback.id] = [...(acc[voteOrFeedback.id] ?? []), item];
    }
    return acc;
  }, {});

  for (const feedItem of items) {
    const repostingItems = repostingItemsByTargetFeedItemId[feedItem.id];
    if (repostingItems?.length > 0) feedItem.repostingItems = repostingItems;
  }

  return items;
};

export const buildProposalFeed = (
  storeState,
  proposalId,
  {
    latestBlockNumber,
    casts,
    includeCandidateItems = true,
    includePropdateItems = true,
  },
) => {
  const proposal = storeState.proposalsById[proposalId];

  if (proposal == null) return [];

  const candidate = storeState.proposalCandidatesById[proposal.candidateId];

  const candidateItems =
    !includeCandidateItems || candidate == null
      ? []
      : buildCandidateFeed(storeState, proposal.candidateId, {
          includeFeedbackPosts: false,
        });

  const castItems =
    casts?.map((c) => {
      const item = createFarcasterCastItem(c);
      item.proposalId = proposal.id;
      return item;
    }) ?? [];

  let voteAndFeedbackPostItems = buildVoteAndFeedbackPostFeedItems({
    proposalId,
    votes: proposal.votes,
    feedbackPosts: [
      ...(proposal?.feedbackPosts ?? []),
      ...(candidate?.feedbackPosts ?? []),
    ],
  });

  if (!includeCandidateItems) {
    voteAndFeedbackPostItems = voteAndFeedbackPostItems.filter(
      (item) => item.candidateId == null,
    );
  }

  const propdateItems = [];

  if (includePropdateItems) {
    propdateItems.push(
      ...(storeState.propdatesByProposalId[proposalId] ?? []).map(
        buildPropdateFeedItem,
      ),
    );
  }

  const updateEventItems =
    proposal.versions
      ?.filter((v) => v.createdBlock > proposal.createdBlock)
      .map((v) => ({
        type: "event",
        eventType: "proposal-updated",
        id: `proposal-update-${v.createdBlock}`,
        body: v.updateMessage,
        blockNumber: v.createdBlock,
        transactionHash: v.createdTransactionHash,
        timestamp: v.createdTimestamp,
        proposalId: proposal.id,
        authorAccount: proposal.proposerId, // only proposer can update proposals
      })) ?? [];

  const items = [
    ...candidateItems,
    ...voteAndFeedbackPostItems,
    ...propdateItems,
    ...updateEventItems,
    ...castItems,
  ];

  if (proposal.createdTimestamp != null)
    items.push({
      type: "event",
      eventType: "proposal-created",
      id: `${proposal.id}-created`,
      timestamp: proposal.createdTimestamp,
      blockNumber: proposal.createdBlock,
      transactionHash: proposal.createdTransactionHash,
      authorAccount: proposal.proposerId,
      proposalId: proposal.id,
    });

  if (proposal.canceledBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-canceled",
      id: `${proposal.id}-canceled`,
      blockNumber: proposal.canceledBlock,
      timestamp: proposal.canceledTimestamp,
      transactionHash: proposal.canceledTransactionHash,
      proposalId: proposal.id,
    });

  if (proposal.queuedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-queued",
      id: `${proposal.id}-queued`,
      blockNumber: proposal.queuedBlock,
      timestamp: proposal.queuedTimestamp,
      transactionHash: proposal.queuedTransactionHash,
      proposalId: proposal.id,
    });

  if (proposal.executedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-executed",
      id: `${proposal.id}-executed`,
      blockNumber: proposal.executedBlock,
      timestamp: proposal.executedTimestamp,
      transactionHash: proposal.executedTransactionHash,
      proposalId: proposal.id,
    });

  if (
    latestBlockNumber > proposal.startBlock &&
    (proposal.canceledBlock == null ||
      proposal.canceledBlock > proposal.startBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-started",
      id: `${proposal.id}-started`,
      blockNumber: proposal.startBlock,
      timestamp: proposal.startTimestamp,
      proposalId: proposal.id,
    });
  }

  if (
    proposal.objectionPeriodEndBlock != null &&
    (proposal.canceledBlock == null ||
      proposal.canceledBlock > proposal.endBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-objection-period-started",
      id: `${proposal.id}-objection-period-start`,
      blockNumber: proposal.endBlock,
      timestamp: proposal.endTimestamp,
      proposalId: proposal.id,
    });
  }

  const actualEndBlock = proposal.objectionPeriodEndBlock ?? proposal.endBlock;
  const actualEndTimestamp =
    proposal.objectionPeriodEndTimestamp ?? proposal.endTimestamp;

  if (
    latestBlockNumber > actualEndBlock &&
    (proposal.canceledBlock == null || proposal.canceledBlock > actualEndBlock)
  ) {
    items.push({
      type: "event",
      eventType: "proposal-ended",
      id: `${proposal.id}-ended`,
      blockNumber: actualEndBlock,
      timestamp: actualEndTimestamp,
      proposalId: proposal.id,
    });
  }

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber ?? 0, order: "desc" },
    items,
  );
};

export const buildCandidateFeed = (
  storeState,
  candidateId,
  { casts, includeFeedbackPosts = true } = {},
) => {
  const candidate = storeState.proposalCandidatesById[candidateId];

  if (candidate == null) return [];

  const targetProposalId = candidate.latestVersion?.targetProposalId;

  const castItems =
    casts?.map((c) => {
      const item = createFarcasterCastItem(c);
      item.candidateId = candidateId;
      return item;
    }) ?? [];

  const feedbackPostItems = includeFeedbackPosts
    ? buildVoteAndFeedbackPostFeedItems({
        candidateId,
        targetProposalId: candidate.latestVersion?.targetProposalId,
        feedbackPosts: candidate.feedbackPosts,
      })
    : [];

  const updateEventItems =
    candidate.versions
      ?.filter((v) => v.createdBlock > candidate.createdBlock)
      .map((v) => ({
        type: "event",
        eventType: "candidate-updated",
        id: `candidate-update-${candidate.id}-${v.id}`,
        body: v.updateMessage,
        blockNumber: v.createdBlock,
        timestamp: v.createdTimestamp,
        transactionHash: v.id?.split("-")?.[0],
        candidateId,
        authorAccount: candidate.proposerId, // only proposer can update
      })) ?? [];

  const items = [...updateEventItems, ...feedbackPostItems, ...castItems];

  if (candidate.createdBlock != null)
    items.push({
      type: "event",
      eventType: "candidate-created",
      id: `${candidate.id}-created`,
      timestamp: candidate.createdTimestamp,
      blockNumber: candidate.createdBlock,
      transactionHash: candidate.createdTransactionHash,
      authorAccount: candidate.proposerId,
      candidateId,
      targetProposalId,
    });

  if (candidate.canceledBlock != null)
    items.push({
      type: "event",
      eventType: "candidate-canceled",
      id: `${candidate.id}-canceled`,
      timestamp: candidate.canceledTimestamp,
      blockNumber: candidate.canceledBlock,
      transactionHash: candidate.canceledTransactionHash,
      candidateId,
      targetProposalId,
    });

  const signatureItems = getCandidateSponsorSignatures(candidate).map((s) => ({
    type: "candidate-signature",
    id: `candidate-signature-${candidate.id}-${s.sig}`,
    authorAccount: s.signer.id,
    body: s.reason,
    voteCount: s.signer.nounsRepresented?.length,
    timestamp: s.createdTimestamp,
    blockNumber: s.createdBlock,
    transactionHash: s.createdTransactionHash,
    expiresAt: s.expirationTimestamp,
    isCanceled: s.canceled,
    candidateId,
    targetProposalId,
    reason: s.reason,
  }));

  return arrayUtils.sortBy({ value: (i) => i.blockNumber ?? 0, order: "desc" }, [
    ...items,
    ...signatureItems,
  ]);
};

const buildAuctionItems = (
  auction,
  { bidsOnly = false, excludeBids = false } = {},
) => {
  const items = [];

  if (!excludeBids) {
    const bids = auction.bids ?? [];
    for (const bid of bids) {
      items.push({
        type: "auction-bid",
        id: `auction-bid-${bid.id}`,
        nounId: auction.nounId,
        authorAccount: bid.bidderId,
        amount: bid.amount,
        blockNumber: bid.blockNumber,
        timestamp: bid.blockTimestamp,
        transactionHash: bid.transactionHash,
      });
    }
  }

  if (bidsOnly) return items;

  items.push({
    type: "event",
    eventType: "auction-started",
    id: `auction-started-${auction.nounId}`,
    nounId: auction.nounId,
    timestamp: auction.startTimestamp,
  });

  if (Date.now() >= auction.endTimestamp) {
    const winningBid = arrayUtils.sortBy(
      { value: (b) => b.amount, order: "desc" },
      auction.bids,
    )[0];

    items.push({
      type: "event",
      eventType: "auction-ended",
      id: `auction-ended-${auction.nounId}`,
      nounId: auction.nounId,
      timestamp: auction.endTimestamp,
      bidderAccount: winningBid?.bidderId,
      bidAmount: winningBid?.amount,
    });
  }

  return items;
};

export const buildAuctionFeed = (storeState, options) => {
  const auctions = Object.values(storeState.nounsById).reduce(
    (auctions, noun) => {
      if (noun.auction == null) return auctions;
      auctions.push(noun.auction);
      return auctions;
    },
    [],
  );

  return auctions.flatMap((a) => buildAuctionItems(a, options));
};

const buildNounTransferAndDelegationItems = (
  transferAndDelegationEvents,
  { includeAuctionSettlements = false, contextAccount } = {},
) => {
  const { address: treasuryAddress } = resolveIdentifier("executor");
  const { address: auctionHouseAddress } = resolveIdentifier("auction-house");
  const { address: forkEscrowAddress } = resolveIdentifier("fork-escrow");

  const {
    transfer: transferEvents = [],
    delegation: delegationEvents = [],
    auctionSettlement: auctionSettlementTransfers = [],
  } = arrayUtils.groupBy((e) => {
    if (
      // Treasury to Auction House transfer
      e.previousAccountId === treasuryAddress &&
      e.newAccountId === auctionHouseAddress
    )
      return "ignore";

    switch (e.type) {
      case "delegate":
        if (
          // Auction settlements
          e.previousAccountId === auctionHouseAddress ||
          // Fork escrows/joins
          e.newAccountId === forkEscrowAddress
        )
          return "ignore";
        return "delegation";

      case "transfer":
        if (e.previousAccountId === auctionHouseAddress)
          return includeAuctionSettlements ? "auctionSettlement" : "ignore";
        return "transfer";

      default:
        throw new Error(`Unrecognized noun event: "${e.type}"`);
    }
  }, transferAndDelegationEvents);

  const auctionSettlementItems = auctionSettlementTransfers.map((e) => ({
    type: "event",
    eventType: "auction-settled",
    id: `${e.nounId}-auction-settled`,
    timestamp: e.blockTimestamp,
    blockNumber: e.blockNumber,
    bidderAccount: e.newAccountId,
    transactionHash: e.transactionHash,
    nounId: e.nounId,
  }));

  const transferItems = transferEvents.map((e) => ({
    type: "noun-transfer",
    id: `${e.nounId}-transfer-${e.id}`,
    timestamp: e.blockTimestamp,
    blockNumber: e.blockNumber,
    nounId: e.nounId,
    fromAccount: e.previousAccountId,
    toAccount: e.newAccountId,
    transactionHash: e.transactionHash,
    contextAccount,
  }));

  const transferEventsByTxHash = arrayUtils.indexBy(
    (e) => e.transactionHash,
    transferEvents,
  );

  const delegationItems = delegationEvents
    // Delegation events are emitted when transferring already delegated tokens,
    // which we don’t care about.
    .filter((e) => {
      const originTransferEvent = transferEventsByTxHash[e.transactionHash];
      return originTransferEvent == null;
    })
    .map((e) => ({
      type: "noun-delegation",
      id: `${e.nounId}-delegation-${e.id}`,
      timestamp: e.blockTimestamp,
      blockNumber: e.blockNumber,
      nounId: e.nounId,
      authorAccount: e.delegatorId,
      fromAccount: e.previousAccountId,
      toAccount: e.newAccountId,
      transactionHash: e.transactionHash,
      contextAccount,
    }));

  // Bulk actions are indexed as one event per noun and transfer. This merges
  // such events into one, referencing the set of nouns and tranfers concerned.
  const transferAndDelegationsItems = Object.entries(
    arrayUtils.groupBy(
      (e) => [e.type, e.transactionHash].join(":"),
      [...transferItems, ...delegationItems],
    ),
  ).map(([groupKey, items]) => {
    const [type] = groupKey.split(":");

    switch (type) {
      case "noun-delegation":
        return {
          ...items[0],
          id: groupKey,
          nouns: items.map((item) => item.nounId),
        };

      case "noun-transfer":
        return {
          ...items[0],
          id: groupKey,
          transfers: items.map((i) => ({
            from: i.fromAccount,
            to: i.toAccount,
            nounId: i.nounId,
          })),
        };

      default:
        throw new Error();
    }
  });

  return [...auctionSettlementItems, ...transferAndDelegationsItems];
};

export const buildNounsTokenRepresentationFeed = (storeState) => {
  const events = Object.values(storeState.nounsById).flatMap(
    (n) => n.events ?? [],
  );
  return buildNounTransferAndDelegationItems(events);
};

export const buildAccountFeed = (storeState, accountAddress_, { filter }) => {
  const accountAddress = accountAddress_.toLowerCase();

  const buildProposalItems = ({ includeCandidateItems = true } = {}) =>
    Object.keys(storeState.proposalsById)
      .flatMap((proposalId) =>
        buildProposalFeed(storeState, proposalId, {
          includePropdates: true,
          includeCandidateItems,
          // TODO: inject Farcaster casts
        }),
      )
      .filter(
        (i) => i.authorAccount != null && i.authorAccount === accountAddress,
      );

  const buildCandidateItems = () =>
    Object.keys(storeState.proposalCandidatesById)
      .flatMap((candidateId) => buildCandidateFeed(storeState, candidateId))
      .filter(
        (i) => i.authorAccount != null && i.authorAccount === accountAddress,
      );

  const buildDelegationAndTransferEventItems = () => {
    const account = storeState.accountsById[accountAddress];
    return buildNounTransferAndDelegationItems(account?.events ?? [], {
      includeAuctionSettlements: true,
      contextAccount: accountAddress,
    });
  };

  const getFilteredItems = () => {
    switch (filter) {
      case "proposals":
        return buildProposalItems();
      case "candidates":
        return buildCandidateItems();
      case "representation":
        return buildDelegationAndTransferEventItems();
      default:
        return [
          ...buildProposalItems({ includeCandidateItems: false }),
          ...buildCandidateItems(),
          ...buildDelegationAndTransferEventItems(),
        ];
    }
  };

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber ?? 0, order: "desc" },
    getFilteredItems(),
  );
};

export const buildPropdateFeedItem = (p) => ({
  type: "event",
  eventType: p.markedCompleted
    ? "propdate-marked-completed"
    : "propdate-posted",
  id: `propdate-${p.id}`,
  body: p.update,
  blockNumber: p.blockNumber,
  authorAccount: p.authorAccount,
  timestamp: p.blockTimestamp,
  proposalId: p.proposalId,
  transactionHash: p.transactionHash,
});
