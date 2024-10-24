import { useReadContract } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";
import { resolveIdentifier } from "../contracts.js";

const { address: contractAddress } = resolveIdentifier("descriptor");

export const useGenerateSVGImage = (seed, { enabled = true } = {}) => {
  const { data } = useReadContract({
    address: contractAddress,
    chainId: CHAIN_ID,
    abi: [
      {
        inputs: [
          {
            components: [
              { name: "background", type: "uint48" },
              { name: "body", type: "uint48" },
              { name: "accessory", type: "uint48" },
              { name: "head", type: "uint48" },
              { name: "glasses", type: "uint48" },
            ],
            name: "seed",
            type: "tuple",
          },
        ],
        name: "generateSVGImage",
        outputs: [{ type: "string" }],
        type: "function",
      },
    ],
    functionName: "generateSVGImage",
    args: [seed],
    query: {
      enabled: enabled && seed != null,
    },
  });

  return data;
};
