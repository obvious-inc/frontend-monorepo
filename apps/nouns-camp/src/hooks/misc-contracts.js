import { parseAbi } from "viem";

import { useContractRead } from "wagmi";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "./chain-id.js";

export const useTokenBuyerEthNeeded = (additionalUsdcTokens) => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: resolveIdentifier(chainId, "token-buyer").address,
    abi: parseAbi([
      "function ethNeeded(uint256, uint256) public view returns (uint256)",
    ]),
    functionName: "ethNeeded",
    args: [additionalUsdcTokens, 5_000],
    enabled: additionalUsdcTokens != null,
  });

  return data;
};
