import { parseAbi } from "viem";
import { useContractRead, useNetwork } from "wagmi";
import { useWallet } from "./wallet.js";
import { contractAddressesByChainId, useProposalState } from "./prechain.js";

export const useProposalThreshold = () => {
  const { chain } = useNetwork();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chain.id].dao,
    abi: parseAbi([
      "function proposalThreshold() public view returns (uint256)",
    ]),
    functionName: "proposalThreshold",
  });

  return data == null ? null : Number(data);
};

const useLatestProposalId = (accountAddress) => {
  const { chain } = useNetwork();

  const { data, isSuccess } = useContractRead({
    address: contractAddressesByChainId[chain.id].dao,
    abi: parseAbi([
      "function latestProposalIds(address account) public view returns (uint256)",
    ]),
    functionName: "latestProposalIds",
    args: [accountAddress],
    enabled: accountAddress != null,
  });

  if (!isSuccess) return undefined;

  return data == null ? null : Number(data);
};

const useCurrentVotes = (accountAddress) => {
  const { chain } = useNetwork();

  const { data, isSuccess } = useContractRead({
    address: contractAddressesByChainId[chain.id].token,
    abi: parseAbi([
      "function getCurrentVotes(address account) external view returns (uint96)",
    ]),
    functionName: "getCurrentVotes",
    args: [accountAddress],
    enabled: accountAddress != null,
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const useCanCreateProposal = () => {
  const { address: connectedAccountAddress } = useWallet();

  const numberOfVotes = useCurrentVotes(connectedAccountAddress);

  const proposalThreshold = useProposalThreshold();

  const latestProposalId = useLatestProposalId(connectedAccountAddress);
  const latestProposalState = useProposalState(latestProposalId);

  if (latestProposalId === undefined) return null;

  const hasActiveProposal =
    latestProposalState != null &&
    ["updatable", "pending", "active", "objection-period"].includes(
      latestProposalState
    );

  if (hasActiveProposal) return false;

  if (proposalThreshold == null) return null;

  const hasEnoughVotes = numberOfVotes > proposalThreshold;

  return hasEnoughVotes;
};
