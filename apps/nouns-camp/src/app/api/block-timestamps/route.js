import { createPublicClient, http } from "viem";
import { CHAIN_ID } from "../../../constants/env.js";
import { getChain } from "../../../utils/chains.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";
import { CACHE_ONE_YEAR } from "next/dist/lib/constants.js";

const chain = getChain(CHAIN_ID);

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const blockNumber = searchParams.get("block");

  if (blockNumber == null)
    return Response.json({ code: "block-required" }, { status: 400 });

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });

  return Response.json(
    { timestamp: Number(block.timestamp) },
    {
      headers: {
        "Cache-Control": `immutable, max-age=${ONE_YEAR_IN_SECONDS}, s-max-age=${CACHE_ONE_YEAR}`,
      },
    },
  );
}
