import { useReadContract } from "wagmi";
import { CHAIN_ID } from "../constants/env.js";
import { resolveIdentifier } from "../contracts.js";

export const useTokenBuyerEthNeeded = (additionalUsdcTokens) => {
  const { data } = useReadContract({
    address: resolveIdentifier("token-buyer").address,
    chainId: CHAIN_ID,
    abi: [
      {
        inputs: [
          { name: "additionalTokens", type: "uint256" },
          { name: "bufferBPs", type: "uint256" },
        ],
        name: "ethNeeded",
        outputs: [{ type: "uint256" }],
        type: "function",
      },
    ],
    functionName: "ethNeeded",
    args: [additionalUsdcTokens, 5_000],
    query: {
      enabled: additionalUsdcTokens != null,
    },
  });

  return data;
};
