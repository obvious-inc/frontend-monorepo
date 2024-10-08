import React from "react";
import { useReadContract, useSimulateContract, useWriteContract } from "wagmi";
import { CHAIN_ID, CAMP_CLIENT_ID } from "@/constants/env";
import { resolveIdentifier } from "../contracts.js";
import useBlockNumber from "./block-number.js";

const { address: contractAddress } = resolveIdentifier("auction-house");

const useRead = ({ enabled = true, ...options }) =>
  useReadContract({
    chainId: CHAIN_ID,
    address: contractAddress,
    ...options,
    query: { enabled },
  });

const useSimulate = ({ enabled = true, ...options }) =>
  useSimulateContract({
    chainId: CHAIN_ID,
    address: contractAddress,
    ...options,
    query: { enabled },
  });

export const useAuction = ({ watch = false } = {}) => {
  const latestBlockNumber = useBlockNumber({
    watch: true,
    query: { enabled: watch },
  });

  const { data, refetch } = useRead({
    abi: [
      {
        name: "auction",
        outputs: [
          {
            components: [
              { name: "nounId", type: "uint96" },
              { name: "amount", type: "uint128" },
              { name: "startTime", type: "uint40" },
              { name: "endTime", type: "uint40" },
              { name: "bidder", type: "address" },
              { name: "settled", type: "bool" },
            ],
            type: "tuple",
          },
        ],
        type: "function",
      },
    ],
    functionName: "auction",
    query: {
      keepPreviousData: true,
    },
  });

  React.useEffect(() => {
    if (!watch) return;
    refetch();
  }, [latestBlockNumber, refetch, watch]);

  return data;
};

export const useReservePrice = (options) => {
  const { data } = useRead({
    abi: [
      {
        name: "reservePrice",
        outputs: [{ type: "uint192" }],
        type: "function",
      },
    ],
    functionName: "reservePrice",
    ...options,
  });

  return data;
};

export const useMinBidIncrementPercentage = (options) => {
  const { data } = useRead({
    abi: [
      {
        name: "minBidIncrementPercentage",
        outputs: [{ type: "uint8" }],
        type: "function",
      },
    ],
    functionName: "minBidIncrementPercentage",
    ...options,
  });

  return data;
};

export const useCreateBid = ({ nounId, bidValue, enabled = true }) => {
  const {
    writeContractAsync,
    status: callStatus,
    error: callError,
  } = useWriteContract();

  const {
    data: simulationResult,
    isSuccess: isSimulationSuccess,
    status: simulationStatus,
    error: simulationError,
  } = useSimulate({
    abi: [
      {
        inputs: [
          { name: "nounId", type: "uint256" },
          { name: "clientId", type: "uint32" },
        ],
        name: "createBid",
        outputs: [],
        type: "function",
      },
    ],
    args: [nounId, CAMP_CLIENT_ID],
    value: bidValue,
    functionName: "createBid",
    enabled,
  });

  return {
    simulationStatus,
    simulationError,
    call: isSimulationSuccess
      ? () => writeContractAsync(simulationResult.request)
      : null,
    callStatus,
    callError,
  };
};

export const useSettleCurrentAndCreateNewAuction = ({
  enabled = true,
} = {}) => {
  const {
    writeContractAsync,
    status: callStatus,
    error: callError,
  } = useWriteContract();

  const {
    data: simulationResult,
    isSuccess: isSimulationSuccess,
    status: simulationStatus,
    error: simulationError,
  } = useSimulate({
    abi: [
      {
        inputs: [],
        name: "settleCurrentAndCreateNewAuction",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    args: [],
    functionName: "settleCurrentAndCreateNewAuction",
    enabled,
  });

  return {
    simulationStatus,
    simulationError,
    call: isSimulationSuccess
      ? () => writeContractAsync(simulationResult.request)
      : null,
    callStatus,
    callError,
  };
};
