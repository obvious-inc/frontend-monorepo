import { array as arrayUtils } from "@shades/common/utils";

export const extractSlugFromId = (candidateId) => {
  const slugParts = candidateId.split("-").slice(1);
  return slugParts.join("-");
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

  const createdEventItem = {
    type: "event",
    eventType: "candidate-created",
    id: `${candidate.id}-created`,
    timestamp: candidate.createdTimestamp,
    blockNumber: candidate.createdBlock,
    authorAccount: candidate.proposerId,
    candidateId,
  };
  const feedbackPostItems =
    candidate.feedbackPosts?.map((p) => ({
      type: "feedback-post",
      id: `${candidate.id}-${p.id}`,
      authorAccount: p.voter.id,
      body: p.reason,
      support: p.supportDetailed,
      voteCount: p.votes,
      timestamp: p.createdTimestamp,
      blockNumber: BigInt(p.createdBlock),
      isPending: p.isPending,
      candidateId,
    })) ?? [];

  const items = [createdEventItem, ...feedbackPostItems];

  if (candidate.canceledBlock != null)
    items.push({
      type: "event",
      eventType: "candidate-canceled",
      id: `${candidate.id}-canceled`,
      timestamp: candidate.createdTimestamp,
      blockNumber: candidate.canceledBlock,
      candidateId,
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
    voteCount: s.signer.nounsRepresented.length,
    expiresAt: s.expirationTimestamp,
    candidateId,
  }));

  const sortedSignatureItems = arrayUtils.sortBy(
    { value: (i) => i.voteCount, order: "desc" },
    signatureItems
  );

  return [...sortedSignatureItems, ...sortedItems];
};
