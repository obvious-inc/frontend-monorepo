import React from "react";
import {
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
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

const useWrite = ({ enabled = true, ...simulateOptions }) => {
  const {
    data: simulationResult,
    isSuccess: isSimulationSuccess,
    status: simulationStatus,
    error: simulationError,
  } = useSimulateContract({
    chainId: CHAIN_ID,
    address: contractAddress,
    ...simulateOptions,
    query: { enabled },
  });

  const {
    data: transactionHash,
    writeContractAsync,
    status: callStatus,
    error: callError,
    reset: resetCall,
  } = useWriteContract({
    query: { enabled },
  });

  const userRejectedRequest =
    callError != null &&
    callError.shortMessage.toLowerCase().includes("user rejected the request");

  const call = () => writeContractAsync(simulationResult.request);

  const {
    data: receipt,
    status: receiptStatus,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
    query: { enabled },
  });

  React.useEffect(() => {
    resetCall();
  }, [simulationResult, resetCall]);

  return {
    simulationStatus: !enabled ? "idle" : simulationStatus,
    simulationError,
    call: isSimulationSuccess ? call : null,
    callStatus: userRejectedRequest ? "idle" : callStatus,
    callError: userRejectedRequest ? null : callError,
    receipt,
    receiptStatus: transactionHash == null ? "idle" : receiptStatus,
    receiptError,
  };
};

export const useAuction = ({ watch = false, enabled = true } = {}) => {
  const latestBlockNumber = useBlockNumber({
    watch: true,
    query: { enabled: enabled && watch },
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
      enabled,
    },
  });

  React.useEffect(() => {
    if (!enabled || !watch) return;
    refetch();
  }, [latestBlockNumber, refetch, enabled, watch]);

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
  return useWrite({
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
};

export const useSettleCurrentAndCreateNewAuction = ({
  enabled = true,
} = {}) => {
  return useWrite({
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
};
