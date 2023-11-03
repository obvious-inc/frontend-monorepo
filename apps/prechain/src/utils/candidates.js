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

export const getValidSponsorSignatures = (candidate) => {
  const signatures = candidate?.latestVersion?.content.contentSignatures ?? [];
  return arrayUtils
    .sortBy({ value: (i) => i.expirationTimestamp, order: "desc" }, signatures)
    .reduce((validSignatures, s) => {
      if (
        // Exclude canceled ones...
        s.canceled ||
        // ...expires ones
        s.expirationTimestamp <= new Date() ||
        // ...multiple ones from the same signer with shorter expiration
        validSignatures.some((s_) => s_.signer.id === s.signer.id)
      )
        // TODO: exclude signers who have an active or pending proposal
        return validSignatures;
      return [...validSignatures, s];
    }, []);
};

export const buildFeed = (candidate, { skipSignatures = false } = {}) => {
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

  const sortedItems = arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );

  if (skipSignatures) return sortedItems;

  const signatureItems = getValidSponsorSignatures(candidate).map((s) => ({
    type: "signature",
    id: `${s.signer.id}-${s.expirationTimestamp.getTime()}`,
    authorAccount: s.signer.id,
    body: s.reason,
    voteCount: s.signer.nounsRepresented?.length,
    expiresAt: s.expirationTimestamp,
    candidateId,
    targetProposalId,
  }));

  const sortedSignatureItems = arrayUtils.sortBy(
    { value: (i) => i.voteCount, order: "desc" },
    signatureItems
  );

  return [...sortedSignatureItems, ...sortedItems];
};

export const getSignals = ({ candidate, proposerDelegate }) => {
  const signatures = getValidSponsorSignatures(candidate);

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
