export const buildProposalCastSignatureMessage = ({
  text,
  proposalId,
  chainId,
  timestamp,
}) =>
  `Sign to submit cast from Nouns Camp:\n\n${text}\n\nProposal ID: ${proposalId}\nChain ID: ${chainId === 1 ? "1 (Mainnet)" : chainId}\nAuthored At: ${timestamp}`;

export const buildCandidateCastSignatureMessage = ({
  text,
  candidateId,
  chainId,
  timestamp,
}) =>
  `Sign to submit cast from Nouns Camp:\n\n${text}\n\nCandidate ID: ${candidateId}\nChain ID: ${chainId === 1 ? "1 (Mainnet)" : chainId}\nAuthored At: ${timestamp}`;

export const buildTransactionLikeSignatureMessage = ({
  hash,
  chainId,
  timestamp,
}) =>
  `Sign to submit transaction like from Nouns Camp:\n\nLiked Transaction Hash: ${hash}\nChain ID: ${chainId === 1 ? "1 (Mainnet)" : chainId}\nAuthored At: ${timestamp}`;

// The Farcaster epoch began on Jan 1, 2021 00:00:00 UTC
const FARCASTER_EPOCH_SECONDS = Date.UTC(2021) / 1000;

export const parseEpochTimestamp = (timestamp) =>
  new Date((timestamp + FARCASTER_EPOCH_SECONDS) * 1000);
