export const truncateAddress = (address) =>
  [address.slice(0, 6), address.slice(-4)].join("...");
