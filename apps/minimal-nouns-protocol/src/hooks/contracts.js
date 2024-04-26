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
import nounsDaoV4Abi from "../nouns-dao-v4-abi.js";
import delegationTokenAbi from "../delegation-token-abi.js";
import useAddress from "./address.jsx";

const abis = {
  "nouns-token": nounsTokenAbi,
  "nouns-descriptor": descriptorAbi,
  "nouns-auction-house": auctionHouseAbi,
  "nouns-dao:v3": nounsDaoV3Abi,
  "nouns-dao:v4": nounsDaoV4Abi,
  "nouns-delegation-token": delegationTokenAbi,
};

const createContractReader =
  (versionedContractIdentifier) =>
  (functionName, { args = [], watch = false, enabled = true } = {}) => {
    const [contractIdentifier] = versionedContractIdentifier.split(":");
    const address = useAddress(contractIdentifier);
    const { data: blockNumber } = useBlockNumber({ watch });

    const { data, status, error, refetch } = useReadContract({
      address,
      abi: abis[versionedContractIdentifier],
      functionName,
      args,
      query: { enabled: enabled && address != null },
    });

    if (error) console.log(contractIdentifier, functionName, error);

    React.useEffect(() => {
      if (!enabled) return;
      refetch();
    }, [enabled, blockNumber, refetch]);

    return { data, error, status };
  };

const createContractBatchReader =
  (versionedContractIdentifier) =>
  (functionName, { args = [], watch = false, enabled = true } = {}) => {
    const [contractIdentifier] = versionedContractIdentifier.split(":");
    const address = useAddress(contractIdentifier);
    const { data: blockNumber } = useBlockNumber({ watch });

    const { data, refetch, status, error } = useReadContracts({
      contracts: args?.map((a) => ({
        address,
        abi: abis[versionedContractIdentifier],
        functionName,
        args: a,
      })),
      query: { enabled: enabled && address != null },
    });

    if (error) console.log(versionedContractIdentifier, functionName, error);

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
  (versionedContractIdentifier) =>
  (functionName, { enabled = true, watch = false, ...options } = {}) => {
    const [contractIdentifier] = versionedContractIdentifier.split(":");
    const address = useAddress(contractIdentifier);

    const { data: blockNumber } = useBlockNumber({ watch, query: { enabled } });

    const {
      data,
      error: simulationError,
      refetch,
    } = useSimulateContract({
      address,
      abi: abis[versionedContractIdentifier],
      functionName,
      ...options,
      query: { enabled: enabled && address != null },
    });

    const { writeContractAsync, status, error: callError } = useWriteContract();

    React.useEffect(() => {
      if (!enabled) return;
      refetch();
    }, [enabled, blockNumber, refetch]);

    const error = callError ?? simulationError;

    if (error) console.log(contractIdentifier, functionName, error, options);

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

export const useNounsDaoV3Write = createContractWriter("nouns-dao:v3");
export const useNounsDaoV3Read = createContractReader("nouns-dao:v3");
export const useNounsDaoV3Reads = createContractBatchReader("nouns-dao:v3");

export const useDelegationTokenWrite = createContractWriter(
  "nouns-delegation-token",
);
export const useDelegationTokenRead = createContractReader(
  "nouns-delegation-token",
);
export const useDelegationTokenReads = createContractBatchReader(
  "nouns-delegation-token",
);

export const useNounsDaoV4Write = createContractWriter("nouns-dao:v4");
export const useNounsDaoV4Read = createContractReader("nouns-dao:v4");
export const useNounsDaoV4Reads = createContractBatchReader("nouns-dao:v4");
