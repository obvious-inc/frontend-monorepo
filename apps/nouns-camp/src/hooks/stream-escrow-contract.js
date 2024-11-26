import { useReadContract, useSimulateContract } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";
import { resolveIdentifier } from "../contracts.js";
import usePublicClient from "./public-client.js";
import { useWriteContract } from "./contract-write.js";

const { address: contractAddress } = resolveIdentifier("stream-escrow");
const { address: tokenContractAddress } = resolveIdentifier("token");

export const useCurrentTick = () => {
  const { data, isSuccess } = useReadContract({
    address: contractAddress,
    chainId: CHAIN_ID,
    abi: [
      {
        inputs: [],
        name: "currentTick",
        outputs: [{ type: "uint32" }],
        type: "function",
      },
    ],
    functionName: "currentTick",
    args: [],
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const useFastForwardStream = (nounId, numberOfTicks) => {
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: contractAddress,
      chainId: CHAIN_ID,
      abi: [
        {
          type: "function",
          name: "fastForwardStream",
          inputs: [{ type: "uint256" }, { type: "uint32" }],
          outputs: [],
        },
      ],
      functionName: "fastForwardStream",
      args: [nounId, numberOfTicks],
      query: {
        enabled: nounId && numberOfTicks,
      },
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

export const useHasTransferApproval = (nounId) => {
  const { data: approvedAddress } = useReadContract({
    address: tokenContractAddress,
    chainId: CHAIN_ID,
    abi: [
      {
        type: "function",
        name: "getApproved",
        inputs: [{ type: "uint256" }],
        outputs: [{ type: "address", name: "operator" }],
      },
    ],
    functionName: "getApproved",
    args: [Number(nounId)],
  });

  if (!approvedAddress) return null;

  return approvedAddress.toLowerCase() == contractAddress.toLowerCase();
};

export const useApproveNounTransfer = (
  nounId,
  { address = contractAddress } = {},
) => {
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: tokenContractAddress,
      chainId: CHAIN_ID,
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [{ type: "address" }, { type: "uint256" }],
          outputs: [],
        },
      ],
      functionName: "approve",
      args: [address, nounId],
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

export const useCancelStream = (nounId, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: contractAddress,
      chainId: CHAIN_ID,
      abi: [
        {
          type: "function",
          name: "cancelStream",
          inputs: [{ type: "uint256" }],
          outputs: [],
        },
      ],
      functionName: "cancelStream",
      args: [nounId],
      enabled,
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};
