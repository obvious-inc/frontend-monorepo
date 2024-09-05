// The Farcaster epoch began on Jan 1, 2021 00:00:00 UTC
const FARCASTER_EPOCH_SECONDS = Date.UTC(2021) / 1000;

export const parseEpochTimestamp = (timestamp) =>
  new Date((timestamp + FARCASTER_EPOCH_SECONDS) * 1000);

export const pickDisplayName = (account) =>
  account.displayName ?? account.username ?? `FID ${account.fid}`;
