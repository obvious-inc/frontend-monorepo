import { isAddress } from "viem";
import { array as arrayUtils } from "@shades/common/utils";

export const normalizeId = (id) => {
  const parts = id.split("-");
  const proposerFirst = isAddress(
    parts[0].startsWith("0x") ? parts[0] : `0x${parts[0]}`,
  );
  const rawProposerId = proposerFirst ? parts[0] : parts.slice(-1)[0];
  const proposerId = rawProposerId.startsWith("0x")
    ? rawProposerId
    : `0x${rawProposerId}`;

  const slug = (proposerFirst ? parts.slice(1) : parts.slice(0, -1)).join("-");

  return `${proposerId.toLowerCase()}-${slug}`;
};

export const extractSlugFromId = (candidateId) => {
  const slugParts = candidateId.split("-").slice(1);
  return slugParts.join("-");
};

export const makeUrlId = (id) => {
  const proposerId = id.split("-")[0];
  const slug = extractSlugFromId(id);
  return `${slug}-${proposerId.slice(2)}`;
};

export const getSponsorSignatures = (
  candidate,
  { excludeInvalid = false, activeProposerIds } = {},
) => {
  const signatures = candidate?.latestVersion?.content.contentSignatures ?? [];
  return arrayUtils
    .sortBy({ value: (i) => i.expirationTimestamp, order: "desc" }, signatures)
    .reduce((signatures, s) => {
      if (!excludeInvalid) return [...signatures, s];

      if (
        // Exclude canceled ones...
        s.canceled ||
        // ...expired ones
        s.expirationTimestamp <= new Date() ||
        // ...signatures from the proposer
        //
        // (The proposer’s voting power is taken into account automatically by
        // the contract. Submitting proposer signatures will reject.)
        s.signer.id.toLowerCase() === candidate.proposerId.toLowerCase() ||
        // ...signatures from signers with active proposals
        activeProposerIds.includes(s.signer.id.toLowerCase()) ||
        // ...duplicates from the same signer with shorter expiration
        signatures.some((s_) => s_.signer.id === s.signer.id)
      )
        return signatures;

      return [...signatures, s];
    }, []);
};

const buildFeedbackPostItems = (candidate) => {
  const targetProposalId = candidate.latestVersion?.targetProposalId;
  const posts = candidate.feedbackPosts ?? [];
  return posts.map((p) => ({
    type: "feedback-post",
    id: p.id,
    authorAccount: p.voterId,
    body: p.reason == null || p.reason.trim() === "" ? null : p.reason,
    support: p.support,
    voteCount: p.voter.nounsRepresented?.length,
    timestamp: p.createdTimestamp,
    blockNumber: BigInt(p.createdBlock),
    isPending: p.isPending,
    candidateId: candidate.id,
    targetProposalId,
  }));
};

export const buildFeed = (candidate, { casts } = {}) => {
  if (candidate == null) return [];

  const candidateId = candidate.id;
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

  const feedbackPostItems = buildFeedbackPostItems(candidate);

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

  const signatureItems = getSponsorSignatures(candidate).map((s) => ({
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

  return arrayUtils.sortBy({ value: (i) => i.timestamp, order: "desc" }, [
    ...items,
    ...signatureItems,
  ]);
};

export const getSignals = ({ candidate, proposerDelegate }) => {
  const signatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds: [], // We can ignore active proposers here
  });

  // Sort first to make sure we pick the most recent feedback from per voter
  const sortedFeedbackPosts = arrayUtils.sortBy(
    { value: (c) => c.createdTimestamp, order: "desc" },
    candidate.feedbackPosts ?? [],
  );

  const votesByAccountAddress = sortedFeedbackPosts.reduce(
    (votesByAccountAddress, post) => {
      if (votesByAccountAddress[post.voter.id] != null)
        return votesByAccountAddress;

      return {
        ...votesByAccountAddress,
        [post.voter.id]: {
          voterId: post.voter.id,
          support: post.support,
          votes: post.voter.nounsRepresented?.length ?? 0,
        },
      };
    },
    // Assume that the sponsors will vote for
    signatures.reduce(
      (acc, s) => {
        return {
          ...acc,
          [s.signer.id]: {
            voterId: s.signer.id,
            support: 1,
            votes: s.nounsRepresented?.length ?? 0,
          },
        };
      },
      proposerDelegate == null
        ? {}
        : {
            [proposerDelegate.id]: {
              votedId: proposerDelegate.id,
              support: 1,
              votes: proposerDelegate.nounsRepresented?.length ?? 0,
            },
          },
    ),
  );

  const votes = Object.values(votesByAccountAddress).reduce((acc, v) => {
    if (v.votes === 0) return acc;
    acc.push(v);
    return acc;
  }, []);

  const {
    0: againstVotes = 0,
    1: forVotes = 0,
    2: abstainVotes = 0,
  } = votes.reduce(
    (acc, v) => ({
      ...acc,
      [v.support]: (acc[v.support] ?? 0) + v.votes,
    }),
    {},
  );

  return {
    votes,
    forVotes,
    againstVotes,
    abstainVotes,
  };
};
