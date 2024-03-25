import React from "react";
import {
  useBlockNumber,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import auctionHouseAbi from "../auction-house-abi.js";
import nounsTokenAbi from "../nouns-token-abi.js";
import descriptorAbi from "../descriptor-v2-abi.js";
import nounsDaoV3Abi from "../nouns-dao-v3-abi.js";
import nounsGovernorAbi from "../nouns-governor-abi.js";
import delegationTokenAbi from "../delegation-token-abi.js";
import { useAddress } from "../addresses.js";

const abiByIdentifier = {
  "nouns-token": nounsTokenAbi,
  "nouns-descriptor": descriptorAbi,
  "nouns-auction-house": auctionHouseAbi,
  "nouns-dao": nounsDaoV3Abi,
  "nouns-governor": nounsGovernorAbi,
  "nouns-delegation-token": delegationTokenAbi,
};

const createContractReader =
  (contractIdentifier) =>
  (functionName, { args = [], watch = false, enabled = true } = {}) => {
    const address = useAddress(contractIdentifier);
    const { data: blockNumber } = useBlockNumber({ watch });

    const { data, status, error, refetch } = useReadContract({
      address,
      abi: abiByIdentifier[contractIdentifier],
      functionName,
      args,
      query: { enabled },
    });

    if (error) console.log(contractIdentifier, functionName, error);

    React.useEffect(() => {
      if (!enabled) return;
      refetch();
    }, [enabled, blockNumber, refetch]);

    return { data, error, status };
  };

const createContractBatchReader =
  (contractIdentifier) =>
  (functionName, { args = [], watch = false, enabled = true } = {}) => {
    const address = useAddress(contractIdentifier);
    const { data: blockNumber } = useBlockNumber({ watch });

    const { data, refetch, status, error } = useReadContracts({
      contracts: args?.map((a) => ({
        address,
        abi: abiByIdentifier[contractIdentifier],
        functionName,
        args: a,
      })),
      query: { enabled },
    });

    if (error) console.log(contractIdentifier, functionName, error);

    React.useEffect(() => {
      if (!enabled || !watch) return;
      refetch();
    }, [enabled, watch, blockNumber, refetch]);

    return {
      data: data?.map((d) => ({ ...d, data: d.result })),
      status,
      error,
    };
  };

const createContractWriter =
  (contractIdentifier) =>
  (functionName, { enabled = true, watch = false, ...options } = {}) => {
    const { data: blockNumber } = useBlockNumber({ watch, query: { enabled } });

    const address = useAddress(contractIdentifier);

    const {
      data,
      error: simulationError,
      refetch,
    } = useSimulateContract({
      address,
      abi: abiByIdentifier[contractIdentifier],
      functionName,
      ...options,
      query: { enabled },
    });

    const { writeContractAsync, status, error: callError } = useWriteContract();

    React.useEffect(() => {
      if (!enabled) return;
      refetch();
    }, [enabled, blockNumber, refetch]);

    const error = callError ?? simulationError;

    if (error) console.log(contractIdentifier, functionName, error);

    if (data?.request == null) return { status, error };

    return {
      call: () => writeContractAsync(data.request),
      status,
      error,
    };
  };

export const useNounsTokenWrite = createContractWriter("nouns-token");
export const useNounsTokenRead = createContractReader("nouns-token");
export const useNounsTokenReads = createContractBatchReader("nouns-token");

export const useDescriptorRead = createContractReader("nouns-descriptor");

export const useAuctionHouseWrite = createContractWriter("nouns-auction-house");
export const useAuctionHouseRead = createContractReader("nouns-auction-house");
export const useAuctionHouseReads = createContractBatchReader(
  "nouns-auction-house",
);

export const useNounsDaoWrite = createContractWriter("nouns-dao");
export const useNounsDaoRead = createContractReader("nouns-dao");
export const useNounsDaoReads = createContractBatchReader("nouns-dao");

export const useDelegationTokenWrite = createContractWriter(
  "nouns-delegation-token",
);
export const useDelegationTokenRead = createContractReader(
  "nouns-delegation-token",
);
export const useDelegationTokenReads = createContractBatchReader(
  "nouns-delegation-token",
);

export const useNounsGovernorWrite = createContractWriter("nouns-governor");
export const useNounsGovernorRead = createContractReader("nouns-governor");
export const useNounsGovernorReads =
  createContractBatchReader("nouns-governor");
