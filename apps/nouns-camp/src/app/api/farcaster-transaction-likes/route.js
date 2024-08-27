import { kv } from "@vercel/kv";
import { createPublicClient, http, isAddress } from "viem";
import { CHAIN_ID } from "../../../constants/env.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";
import { getChain } from "../../../utils/chains.js";
import {
  parseEpochTimestamp,
  buildTransactionLikeSignatureMessage,
} from "../../../utils/farcaster.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
import {
  fetchNounerLikesByTargetUrl,
  verifyEthAddress,
  submitTargetLikeAdd,
} from "../farcaster-utils.js";

const chain = getChain(CHAIN_ID);

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (hash == null) return jsonResponse(400, { error: "hash-required" });

  const likes = await fetchNounerLikesByTargetUrl(
    createTransactionReceiptUri(CHAIN_ID, hash),
  );

  return jsonResponse(
    200,
    { likes },
    { "Cache-Control": "max-age=10, stale-while-revalidate=20" },
  );
}

export async function POST(request) {
  const { hash, fid, timestamp, ethAddress, ethSignature } =
    await request.json();

  if (hash == null) return jsonResponse(400, { error: "hash-required" });
  if (fid == null) return jsonResponse(400, { error: "fid-required" });
  if (timestamp == null)
    return jsonResponse(400, { error: "timestamp-required" });
  if (!isAddress(ethAddress))
    return jsonResponse(400, { error: "eth-address-required" });
  if (ethSignature == null)
    return jsonResponse(400, { error: "eth-signature-required" });

  // Allow up to 10 minute old signatures
  if (new Date() + 10 * 60 * 1000 > new Date(timestamp))
    return jsonResponse(400, { error: "signature-expired" });

  const publicClient = createPublicClient({
    chain,
    transport: http(getJsonRpcUrl(chain.id)),
  });

  const isValidSignature = await publicClient.verifyMessage({
    address: ethAddress,
    message: buildTransactionLikeSignatureMessage({
      hash,
      chainId: CHAIN_ID,
      timestamp,
    }),
    signature: ethSignature,
  });

  if (!isValidSignature)
    return jsonResponse(401, { error: "invalid-signature" });

  const isVerifiedEthAddress = await verifyEthAddress(fid, ethAddress);

  if (!isVerifiedEthAddress)
    return jsonResponse(401, { error: "invalid-address" });

  const privateAccountKey = await kv.get(`fid:${fid}:account-key`);

  if (privateAccountKey == null)
    return jsonResponse(401, { error: "no-account-key-for-eth-address" });

  try {
    const reactionMessage = await submitTargetLikeAdd(fid, privateAccountKey, {
      targetUrl: createTransactionReceiptUri(CHAIN_ID, hash),
    });
    return jsonResponse(201, {
      hash: reactionMessage.hash,
      fid: reactionMessage.data.fid,
      timestamp: parseEpochTimestamp(
        reactionMessage.data.timestamp,
      ).toISOString(),
    });
  } catch (e) {
    return jsonResponse(500, { error: "submit-failed" });
  }
}
