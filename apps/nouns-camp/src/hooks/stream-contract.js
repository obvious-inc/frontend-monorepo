import { useReadContracts } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";

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
    name: "recipientActiveBalance",
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
];

export const useStreamData = ({ streamContractAddress }) => {
  const { data } = useReadContracts({
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
        functionName: "recipientActiveBalance",
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
    recipientActiveBalance,
    token,
  ] = data.map((d) => d?.result);

  return {
    startTime,
    stopTime,
    elapsedTime,
    remainingBalance,
    recipientActiveBalance,
    token,
  };
};
