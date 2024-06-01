import { isAddress } from "viem";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useSimulateContract,
} from "wagmi";
import { resolveIdentifier } from "../contracts.js";
import usePublicClient from "./public-client.js";

const getContractAddress = () =>
  resolveIdentifier("token").address;

export const useCurrentVotes = (accountAddress) => {
  const { data, isSuccess } = useReadContract({
    address: getContractAddress(),
    abi: [
      {
        inputs: [{ type: "address" }],
        name: "getCurrentVotes",
        outputs: [{ type: "uint96" }],
        type: "function",
      },
    ],
    functionName: "getCurrentVotes",
    args: [accountAddress],
    query: {
      enabled: accountAddress != null,
    },
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const usePriorVotes = ({ account, blockNumber, enabled = true }) => {
  const { data } = useReadContract({
    address: getContractAddress(),
    abi: [
      {
        inputs: [{ type: "address" }, { type: "uint256" }],
        name: "getPriorVotes",
        outputs: [{ type: "uint96" }],
        type: "function",
      },
    ],
    functionName: "getPriorVotes",
    args: [account, blockNumber],
    query: {
      enabled: enabled && account != null && blockNumber != null,
    },
  });

  return data == null ? null : Number(data);
};

export const useNounSeed = (nounId, { enabled = true } = {}) => {
  const { data } = useReadContract({
    address: getContractAddress(),
    abi: [
      {
        inputs: [{ type: "uint256" }],
        name: "seeds",
        outputs: [
          { name: "background", type: "uint48" },
          { name: "body", type: "uint48" },
          { name: "accessory", type: "uint48" },
          { name: "head", type: "uint48" },
          { name: "glasses", type: "uint48" },
        ],
        type: "function",
      },
    ],
    functionName: "seeds",
    args: [nounId],
    query: {
      enabled: enabled && nounId != null,
    },
  });

  if (data == null) return null;

  return {
    background: data[0],
    body: data[1],
    accessory: data[2],
    head: data[3],
    glasses: data[4],
  };
};

export const useNounSeeds = (nounIds, { enabled = true } = {}) => {
  const { data } = useReadContracts({
    contracts: nounIds.map((nounId) => ({
      address: getContractAddress(),
      abi: [
        {
          inputs: [{ type: "uint256" }],
          name: "seeds",
          outputs: [
            { name: "background", type: "uint48" },
            { name: "body", type: "uint48" },
            { name: "accessory", type: "uint48" },
            { name: "head", type: "uint48" },
            { name: "glasses", type: "uint48" },
          ],
          type: "function",
        },
      ],
      functionName: "seeds",
      args: [nounId],
    })),
    query: { enabled },
  });

  if (data == null || data.some((d) => d.result == null)) return null;

  return data.map((d) => ({
    background: d.result[0],
    body: d.result[1],
    accessory: d.result[2],
    head: d.result[3],
    glasses: d.result[4],
  }));
};

export const useSetDelegate = (address) => {
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(),
      abi: [
        {
          type: "function",
          name: "delegate",
          inputs: [{ type: "address" }],
          outputs: [],
        },
      ],
      functionName: "delegate",
      args: [address],
      query: {
        enabled: isAddress(address),
      },
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};
