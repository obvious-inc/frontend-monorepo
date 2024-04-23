import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";

export const buildProposalCastSignatureMessage = ({
  text,
  proposalId,
  chainId,
  timestamp,
}) =>
  `Sign to submit cast from Nouns Camp:\n\n${text}\n\nProposal ID: ${proposalId}\nChain ID: ${chainId === 1 ? "1 (Mainnet)" : chainId}\nAuthored At: ${timestamp}`;

export const createCanonicalProposalUrl = (chainId, proposalId) => {
  const { address: daoContractAddress } = resolveContractIdentifier(
    chainId,
    "dao",
  );
  if (daoContractAddress == null)
    throw new Error(`No contract found for chain "${chainId}"`);
  const erc681Uri = `${daoContractAddress}/proposals?uint256=${proposalId}`;
  return `chain://eip155:${chainId}/erc681:${encodeURIComponent(erc681Uri)}`;
};
