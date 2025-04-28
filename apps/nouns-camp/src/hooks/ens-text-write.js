import { useEnsResolver } from "wagmi";
import { normalize, namehash } from "viem/ens";
import { useWriteContract } from "@/hooks/contract-write";
import { CHAIN_ID } from "@/constants/env";

// ENS Public Resolver ABI (partial, just for setText function)
const ensPublicResolverAbi = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
];

export const useEnsTextWrite = (ensName, key) => {
  const {
    // eslint-disable-next-line no-unused-vars
    writeContract,
    writeContractAsync,
    ...rest
  } = useWriteContract();

  const normalizedName = normalize(ensName);

  const { data: resolverAddress } = useEnsResolver({
    name: normalizedName,
    chainId: CHAIN_ID,
  });

  const setEnsTextRecord = async (value) => {
    try {
      if (!ensName) {
        throw new Error("ENS name is required");
      }

      if (resolverAddress == null) {
        throw new Error("Could not find resolver for ENS name");
      }

      // Call setText on the resolver
      return await writeContractAsync({
        address: resolverAddress,
        abi: ensPublicResolverAbi,
        functionName: "setText",
        args: [
          // Get the namehash
          namehash(normalizedName),
          key,
          value,
        ],
      });
    } catch (error) {
      console.error("Error setting ENS text record:", error);
      throw error;
    }
  };

  return { write: setEnsTextRecord, ...rest };
};

export default useEnsTextWrite;
