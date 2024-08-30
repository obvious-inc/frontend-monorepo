import {
  usePublicClient,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { CHAIN_ID } from "../constants/env.js";
import { isAddress } from "viem";

const streamDataAbi = [
  {
    inputs: [],
    name: "elapsedTime",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "recipient",
    outputs: [{ type: "address" }],
    type: "function",
  },
  {
    inputs: [],
    name: "recipientBalance",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "recipientCancelBalance",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "remainingBalance",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "startTime",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "stopTime",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [],
    name: "token",
    outputs: [{ type: "address" }],
    type: "function",
  },
  {
    inputs: [],
    name: "tokenAmount",
    outputs: [{ type: "uint256" }],
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export const useStreamData = ({ streamContractAddress }) => {
  const { data, queryKey } = useReadContracts({
    contracts: [
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "startTime",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "stopTime",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "elapsedTime",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "remainingBalance",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "recipientBalance",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "recipientCancelBalance",
        args: [],
      },
      {
        address: streamContractAddress,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "token",
        args: [],
      },
    ],
  });

  if (!data) return {};

  const [
    startTime,
    stopTime,
    elapsedTime,
    remainingBalance,
    recipientBalance,
    recipientCancelBalance,
    token,
  ] = data.map((d) => d?.result);

  return {
    startTime,
    stopTime,
    elapsedTime,
    remainingBalance,
    recipientBalance,
    recipientCancelBalance,
    token,
    queryKey,
  };
};

export const useStreamWithdraw = (streamAddress, amount) => {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: streamAddress,
      chainId: CHAIN_ID,
      abi: streamDataAbi,
      functionName: "withdraw",
      args: [amount],
      query: {
        enabled: isAddress(streamAddress) && amount > 0,
      },
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

export const useStreamsRemainingBalances = (streamAddresses) => {
  const { data } = useReadContracts({
    contracts: streamAddresses.flatMap((address) => [
      {
        address,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "remainingBalance",
        args: [],
      },
      {
        address,
        chainId: CHAIN_ID,
        abi: streamDataAbi,
        functionName: "recipientBalance",
        args: [],
      },
    ]),
  });

  if (!data) return [];

  // The data is returned in the order of the contracts passed in
  return streamAddresses.map((_, i) => ({
    remainingBalance: data[i * 2]?.result,
    recipientBalance: data[i * 2 + 1]?.result,
  }));
};
