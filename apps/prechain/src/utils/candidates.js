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
