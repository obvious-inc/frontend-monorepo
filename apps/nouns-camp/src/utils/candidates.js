import { array as arrayUtils } from "@shades/common/utils";

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
  { excludeInvalid = false, activeProposerIds } = {}
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

export const buildFeed = (candidate) => {
  if (candidate == null) return [];

  const candidateId = candidate.id;
  const targetProposalId = candidate.latestVersion?.targetProposalId;

  const createdEventItem = {
    type: "event",
    eventType: "candidate-created",
    id: `${candidate.id}-created`,
    timestamp: candidate.createdTimestamp,
    blockNumber: candidate.createdBlock,
    authorAccount: candidate.proposerId,
    candidateId,
    targetProposalId,
  };
  const feedbackPostItems =
    candidate.feedbackPosts?.map((p) => ({
      type: "feedback-post",
      id: `${candidate.id}-${p.id}`,
      authorAccount: p.voterId,
      body: p.reason,
      support: p.support,
      voteCount: p.voter.nounsRepresented?.length,
      timestamp: p.createdTimestamp,
      blockNumber: BigInt(p.createdBlock),
      isPending: p.isPending,
      candidateId,
      targetProposalId,
    })) ?? [];

  const items = [createdEventItem, ...feedbackPostItems];

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
    id: `${s.signer.id}-${s.expirationTimestamp.getTime()}`,
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

  return arrayUtils.sortBy({ value: (i) => i.blockNumber, order: "desc" }, [
    ...items,
    ...signatureItems,
  ]);
};

export const getSignals = ({ candidate, proposerDelegate }) => {
  const signatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds: [], // We can ignore active proposers here
  });

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const sponsorNounIds = signatures.flatMap((s) =>
    s.signer.nounsRepresented.map((n) => n.id)
  );

  const sponsoringNounIds = arrayUtils.unique([
    ...sponsorNounIds,
    ...proposerDelegateNounIds,
  ]);
  const sponsorIds = arrayUtils.unique(
    [
      ...signatures.map((s) => s.signer.id),
      proposerDelegateNounIds.length === 0 ? null : proposerDelegate.id,
    ].filter(Boolean)
  );

  // Sort first to make sure we pick the most recent feedback from per voter
  const sortedFeedbackPosts = arrayUtils.sortBy(
    { value: (c) => c.createdTimestamp, order: "desc" },
    candidate.feedbackPosts ?? []
  );

  const supportByNounId = sortedFeedbackPosts.reduce(
    (supportByNounId, post) => {
      const nounIds = post.voter.nounsRepresented?.map((n) => n.id) ?? [];
      const newSupportByNounId = {};

      for (const nounId of nounIds) {
        if (supportByNounId[nounId] != null) continue;
        newSupportByNounId[nounId] = post.support;
      }

      return { ...supportByNounId, ...newSupportByNounId };
    },
    // Assume that the sponsors will vote for
    sponsoringNounIds.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
  );

  const supportByDelegateId = sortedFeedbackPosts.reduce(
    (supportByDelegateId, post) => {
      if (supportByDelegateId[post.voterId] != null) return supportByDelegateId;
      return { ...supportByDelegateId, [post.voterId]: post.support };
    },
    // Assume that sponsors will vote for
    sponsorIds.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
  );

  const countSignals = (supportList) =>
    supportList.reduce(
      (acc, support) => {
        const signalGroup = { 0: "against", 1: "for", 2: "abstain" }[support];
        return { ...acc, [signalGroup]: acc[signalGroup] + 1 };
      },
      { for: 0, against: 0, abstain: 0 }
    );

  return {
    votes: countSignals(Object.values(supportByNounId)),
    delegates: countSignals(Object.values(supportByDelegateId)),
  };
};
