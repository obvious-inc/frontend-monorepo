import { createPublicClient, http } from "viem";
import { CHAIN_ID } from "../../../constants/env.js";
import { getChain } from "../../../utils/chains.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";

const chain = getChain(CHAIN_ID);

const MAX_AGE = 5; // 5 seconds

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

export async function GET() {
  const blockNumber = await publicClient.getBlockNumber();

  return Response.json(
    { number: String(blockNumber) },
    {
      headers: {
        "Cache-Control": `immutable, max-age=${MAX_AGE}, s-max-age=${MAX_AGE}`,
      },
    },
  );
}
