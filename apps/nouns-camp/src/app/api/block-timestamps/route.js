import { createPublicClient, http } from "viem";
import { CHAIN_ID } from "../../../constants/env.js";
import { getChain } from "../../../utils/chains.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";

export const runtime = 'edge';

const chain = getChain(CHAIN_ID);

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
        "Cache-Control": `public, immutable, max-age=${365 * 24 * 60 * 60}`,
      },
    },
  );
}
