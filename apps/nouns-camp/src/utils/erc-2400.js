export const createUri = (chainId, transactionHash) => {
  if (chainId == null || transactionHash == null) throw new Error();
  const uri = `ethereum:tx-${transactionHash}`;
  if (String(chainId) === "1") return uri;
  return uri + `@${chainId}`;
};
