import { isAddress } from "viem";
import { array as arrayUtils } from "@shades/common/utils";

export const isStillEncoded = (str) => {
  return /%[0-9A-Fa-f]{2}/.test(str);
};

export const isApplicationSlug = (slug) => {
  return typeof slug === 'string' && slug.startsWith('nouns-grants-');
};

export const safelyDecodeURIComponent = (str) => {
  let decoded = str;
  let previousDecoded = "";

  while (decoded !== previousDecoded && isStillEncoded(decoded)) {
    try {
      previousDecoded = decoded;
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      return previousDecoded;
    }
  }

  return decoded;
};

export const normalizeId = (id) => {
  const fullyDecodedId = safelyDecodeURIComponent(id);

  const parts = fullyDecodedId.split("-");
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
  { excludeInvalid = false, activeProposerIds = [] } = {},
) => {
  const signatures = candidate?.latestVersion?.content.contentSignatures ?? [];
  return arrayUtils
    .sortBy({ value: (i) => i.expirationTimestamp, order: "desc" }, signatures)
    .reduce((signatures, s) => {
      // Exclude canceled ones...
      const isCanceled = s.canceled;
      // ...expired ones
      const hasExpired = s.expirationTimestamp <= new Date();
      // ...signatures from signers with active proposals
      const isActiveProposer = activeProposerIds.includes(
        s.signer.id.toLowerCase(),
      );
      // ...signatures from the proposer
      // (The proposer’s voting power is taken into account automatically by
      // the contract. Submitting proposer signatures will reject.)
      const isProposer =
        s.signer.id.toLowerCase() === candidate.proposerId.toLowerCase();
      // ...duplicates from the same signer with shorter expiration
      const isOldSignature = signatures.some(
        (s_) => s_.signer.id === s.signer.id,
      );

      const status =
        isProposer || isOldSignature
          ? "redundant"
          : isCanceled
            ? "canceled"
            : hasExpired
              ? "expired"
              : isActiveProposer
                ? "busy"
                : "valid";

      if (excludeInvalid && status !== "valid") return signatures;

      return [...signatures, { ...s, status }];
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
      if (votesByAccountAddress[post.voterId] != null)
        return votesByAccountAddress;

      return {
        ...votesByAccountAddress,
        [post.voterId]: {
          voterId: post.voterId,
          support: post.support,
          votes: post.votes ?? 0,
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

const hadRecentActivity = ({ threshold }, c) =>
  c.createdTimestamp > threshold ||
  c.lastUpdatedTimestamp > threshold ||
  (c.feedbackPosts != null &&
    c.feedbackPosts.some((p) => p.createdTimestamp > threshold));

export const getForYouGroup = (
  { connectedAccountAddress, activeThreshold, newThreshold },
  c,
) => {
  // const { content } = c.latestVersion;
  const connectedAccount = connectedAccountAddress;

  // Proposal updates
  if (c.latestVersion.targetProposalId != null) {
    if (c.proposerId.toLowerCase() === connectedAccount)
      return "authored-proposal-update";

    const hasSigned = (c) => {
      const signatures = getSponsorSignatures(c, {
        excludeInvalid: true,
        activeProposerIds: [],
      });
      return signatures.some(
        (s) => s.signer.id.toLowerCase() === connectedAccount,
      );
    };

    const isSponsor =
      c.targetProposal?.signers != null &&
      c.targetProposal.signers.some(
        (s) => s.id.toLowerCase() === connectedAccount,
      );

    if (isSponsor && !hasSigned(c))
      return "sponsored-proposal-update-awaiting-signature";
  }

  const isActive = hadRecentActivity({ threshold: activeThreshold }, c);

  // if (c.proposerId.toLowerCase() === connectedAccount) return "authored";

  if (!isActive) return "inactive";

  // if (
  //   content.contentSignatures.some(
  //     (s) => !s.canceled && s.signer.id.toLowerCase() === connectedAccount,
  //   )
  // )
  //   return "sponsored";

  if (c.createdTimestamp >= newThreshold) return "new";

  return "active";
};

export const getScore = (candidate) => {
  const { votes } = getSignals({ candidate });
  const {
    0: againstVotes = [],
    1: forVotes = [],
    2: abstainVotes = [],
  } = arrayUtils.groupBy((v) => v.support, votes);

  if (forVotes.length === 0 && abstainVotes.length === 0) return null;
  return forVotes.length - againstVotes.length;
};

const ZERO_ADDRESS = "0x".padEnd(42, "0");

export const createTopicTransactions = () => [
  { type: "transfer", target: ZERO_ADDRESS, value: 0n },
];

export const matchTopicTransactions = (transactions) => {
  if (transactions.length === 0) return true;
  if (transactions.length > 1) return false;
  const tx = transactions[0];
  return tx.type === "transfer" && tx.target === ZERO_ADDRESS && tx.value == 0n;
};

// Helper function to determine candidate type based on slug and transactions
export const determineCandidateType = (slug, transactions) => {
  if (isApplicationSlug(slug)) return "application";
  if (matchTopicTransactions(transactions)) return "topic";
  return "proposal";
};
