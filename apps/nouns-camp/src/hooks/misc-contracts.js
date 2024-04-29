import { useReadContract } from "wagmi";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "./chain-id.js";

export const useTokenBuyerEthNeeded = (additionalUsdcTokens) => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: resolveIdentifier(chainId, "token-buyer").address,
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
