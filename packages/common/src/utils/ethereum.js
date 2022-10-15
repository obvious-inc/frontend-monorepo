export const truncateAddress = (address) =>
  [address.slice(0, 5), address.slice(-3)].join("...");
