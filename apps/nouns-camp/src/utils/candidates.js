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
