"use client";

import { array as arrayUtils } from "@shades/common/utils";
import { resolveIdentifier } from "../contracts.js";
import {
  createReplyExtractor,
  createRepostExtractor,
} from "../utils/votes-and-feedbacks.js";
import { getSponsorSignatures as getCandidateSponsorSignatures } from "../utils/candidates.js";

const buildVoteAndFeedbackPostFeedItems = ({
  proposalId,
  votes = [],
  feedbackPosts = [],
}) => {
  // Hide proposal votes with 0 voting power account if no reason is given
  const filteredVotes = votes.filter(
    (v) => v.votes > 0 || (v.reason?.trim() ?? "") !== "",
  );
  const ascendingVotesAndFeedbackPosts = arrayUtils.sortBy("createdBlock", [
    ...filteredVotes,
    ...feedbackPosts,
  ]);

  return ascendingVotesAndFeedbackPosts.reduce((acc, p, postIndex) => {
    const previousItems = ascendingVotesAndFeedbackPosts.slice(0, postIndex);
    const extractReplies = createReplyExtractor(previousItems);
    const extractReposts = createRepostExtractor(previousItems);
    const [reposts, reasonWithStrippedReposts] = extractReposts(p.reason);
    const [replies, reasonWithStrippedRepliesAndReposts] = extractReplies(
      reasonWithStrippedReposts,
    );

    // Don’t include candidate items
    if (p.candidateId != null) return acc;

    acc.push({
      id: p.id,
      type: p.type,
      support: p.support,
      authorAccount: p.voterId,
      blockNumber: p.createdBlock,
      timestamp: p.createdTimestamp,
      voteCount: p.votes,
      proposalId,
      isPending: p.isPending,
      body: reasonWithStrippedRepliesAndReposts,
      replies,
      reposts,
      reason: p.reason,
    });

    return acc;
  }, []);
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
      let displayName =
        c.account?.displayName ?? c.account?.username ?? `FID ${c.fid}`;

      if (
        c.account?.username != null &&
        c.account.username !== c.account.displayName
      )
        displayName += ` (@${c.account.username})`;

      return {
        type: "farcaster-cast",
        id: c.hash,
        authorAccount: c.account?.nounerAddress,
        authorAvatarUrl: c.account?.pfpUrl,
        authorDisplayName: displayName,
        body: c.text,
        timestamp: new Date(c.timestamp),
        proposalId: proposal.id,
      };
    }) ?? [];

  const voteAndFeedbackPostItems = buildVoteAndFeedbackPostFeedItems({
    proposalId,
    votes: proposal.votes,
    feedbackPosts: [
      ...(proposal?.feedbackPosts ?? []),
      ...(candidate?.feedbackPosts ?? []),
    ],
  });

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
      proposalId: proposal.id,
    });

  if (proposal.queuedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-queued",
      id: `${proposal.id}-queued`,
      blockNumber: proposal.queuedBlock,
      timestamp: proposal.queuedTimestamp,
      proposalId: proposal.id,
    });

  if (proposal.executedBlock != null)
    items.push({
      type: "event",
      eventType: "proposal-executed",
      id: `${proposal.id}-executed`,
      blockNumber: proposal.executedBlock,
      timestamp: proposal.executedTimestamp,
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

  const buildFeedbackPostItems = (candidate) => {
    const targetProposalId = candidate.latestVersion?.targetProposalId;
    const posts = candidate.feedbackPosts ?? [];
    return posts.map((p) => ({
      type: "feedback-post",
      id: p.id,
      authorAccount: p.voterId,
      body: p.reason == null || p.reason.trim() === "" ? null : p.reason,
      support: p.support,
      voteCount: p.votes,
      timestamp: p.createdTimestamp,
      blockNumber: BigInt(p.createdBlock),
      isPending: p.isPending,
      candidateId: candidate.id,
      targetProposalId,
    }));
  };

  const targetProposalId = candidate.latestVersion?.targetProposalId;

  const castItems =
    casts?.map((c) => {
      let displayName =
        c.account?.displayName ?? c.account?.username ?? `FID ${c.fid}`;

      if (
        c.account?.username != null &&
        c.account.username !== c.account.displayName
      )
        displayName += ` (@${c.account.username})`;

      return {
        type: "farcaster-cast",
        id: c.hash,
        authorAccount: c.account?.nounerAddress,
        authorAvatarUrl: c.account?.pfpUrl,
        authorDisplayName: displayName,
        body: c.text,
        timestamp: new Date(c.timestamp),
        candidateId,
      };
    }) ?? [];

  const feedbackPostItems = includeFeedbackPosts
    ? buildFeedbackPostItems(candidate)
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
      candidateId,
      targetProposalId,
    });

  const signatureItems = getCandidateSponsorSignatures(candidate).map((s) => ({
    type: "candidate-signature-added",
    id: `candidate-signature-added-${candidate.id}-${s.sig}`,
    authorAccount: s.signer.id,
    body: s.reason,
    voteCount: s.signer.nounsRepresented?.length,
    timestamp: s.createdTimestamp,
    blockNumber: s.createdBlock,
    expiresAt: s.expirationTimestamp,
    isCanceled: s.canceled,
    candidateId,
    targetProposalId,
  }));

  return arrayUtils.sortBy({ value: (i) => i.blockNumber ?? 0, order: "desc" }, [
    ...items,
    ...signatureItems,
  ]);
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
    const events = account?.events ?? [];

    const { address: auctionHouseAddress } = resolveIdentifier("auction-house");

    const isFromAuctionHouse = (e) =>
      e.previousAccountId === auctionHouseAddress;
    const isToAuctionHouse = (e) => e.newAccountId === auctionHouseAddress;

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
      .filter((e) => e.type === "transfer" && isFromAuctionHouse(e))
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
      .filter((e) => e.type === "delegate" && !isFromAuctionHouse(e))
      .map((e) => {
        const eventType =
          accountAddress === e.previousAccountId &&
          accountAddress !== e.delegatorId
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
          e.type === "transfer" &&
          !isFromAuctionHouse(e) &&
          !isToAuctionHouse(e),
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
        accountRef: accountAddress,
      }));

    // Bulk actions are indexed as one event per noun. This merges such events
    // into one, referencing the sef of nouns concerned.
    const eventItems = Object.values(
      arrayUtils.groupBy(
        (e) => `${e.transactionHash}-${e.type}-${e.fromAccount}-${e.toAccount}`,
        [
          ...delegatedEventItems,
          ...transferredEventItems,
          ...auctionBoughtEventItems,
        ],
      ),
    ).map((group) => {
      const lastEvent = group[group.length - 1];
      return {
        ...lastEvent,
        id: `${lastEvent.blockNumber}-${lastEvent.transactionHash}-${lastEvent.type}-${lastEvent.fromAccount}-${lastEvent.toAccount}`,
        nouns: group.map((e) => e.nounId),
      };
    });

    return eventItems;
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
});
