import { kv } from "@vercel/kv";
import { verifyMessage, hexToBytes, isAddress } from "viem";
import {
  FarcasterNetwork,
  Message,
  NobleEd25519Signer,
  makeCastAdd,
} from "@farcaster/core";
import { subgraphFetch } from "../../../nouns-subgraph.js";
import {
  parseEpochTimestamp,
  buildProposalCastSignatureMessage,
} from "../../../utils/farcaster.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";

const { FARCASTER_HUB_HTTP_ENDPOINT, NEYNAR_API_KEY } = process.env;

const createCanonicalProposalUrl = async (chainId, proposalId) => {
  const { proposal } = await subgraphFetch({
    chainId,
    query: `
      query {
        proposal(id: ${proposalId}) {
          createdTransactionHash
        }
      }`,
  });

  if (proposal == null) throw new Error();

  return createTransactionReceiptUri(chainId, proposal.createdTransactionHash);
};

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

const fetchVerificiation = async (fid, address) => {
  const searchParams = new URLSearchParams({ fid, address });
  const response = await fetch(
    `${FARCASTER_HUB_HTTP_ENDPOINT}/v1/verificationsByFid?${searchParams}`,
    {
      headers: {
        api_key: NEYNAR_API_KEY,
      },
    },
  );

  const body = await response.json();

  if (!response.ok) {
    if (body.errCode === "not_found") return null;
    console.error(body);
    throw new Error();
  }

  return body;
};

const fetchProposalCasts = async (chainId, proposalId) => {
  const searchParams = new URLSearchParams({
    feed_type: "filter",
    filter_type: "parent_url",
    parent_url: await createCanonicalProposalUrl(chainId, proposalId),
    limit: 100,
  });

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/feed?${searchParams}`,
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  const { casts } = await response.json();

  // TODO: Recursively fetch all casts
  // TODO: Include replies

  return casts.reduce(
    ({ casts, accounts }, c) => {
      casts.push({
        hash: c.hash,
        fid: c.author.fid,
        text: c.text,
        timestamp: c.timestamp,
      });

      if (!accounts.some((a) => a.fid === c.author.fid))
        accounts.push({
          fid: c.author.fid,
          username:
            c.author.username === `!${c.author.fid}` ? null : c.author.username,
          displayName: c.author.display_name,
          pfpUrl: c.author.pfp_url,
        });

      return { casts, accounts };
    },
    { casts: [], accounts: [] },
  );
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chain");
  const proposalId = searchParams.get("proposal");

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
  if (proposalId == null)
    return jsonResponse(400, { error: "proposal-required" });

  const { casts, accounts } = await fetchProposalCasts(chainId, proposalId);

  return jsonResponse(
    200,
    { casts, accounts },
    {
      "Cache-Control": "max-age=10, stale-while-revalidate=20",
    },
  );
}

const submitCast = async (body, data, signer) => {
  const messageResult = await makeCastAdd(body, data, signer);
  return messageResult.match(
    async (message) => {
      const response = await fetch(
        `${FARCASTER_HUB_HTTP_ENDPOINT}/v1/submitMessage`,
        {
          method: "POST",
          body: Buffer.from(Message.encode(message).finish()),
          headers: {
            api_key: NEYNAR_API_KEY,
            "Content-Type": "application/octet-stream",
          },
        },
      );

      const body = await response.json();

      if (!response.ok) {
        console.error(body);
        throw new Error();
      }

      return body;
    },
    (error) => Promise.reject(error),
  );
};

const verifyEthAddress = async (fid, address) => {
  const verification = await fetchVerificiation(fid, address);
  // TODO: verify the verification
  return verification != null;
};

export async function POST(request) {
  const {
    chainId,
    proposalId,
    text,
    fid,
    timestamp,
    ethAddress,
    ethSignature,
  } = await request.json();

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
  if (proposalId == null)
    return jsonResponse(400, { error: "proposal-required" });
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

  const isValidSignature = await verifyMessage({
    address: ethAddress,
    message: buildProposalCastSignatureMessage({
      text,
      proposalId,
      chainId,
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
    const castMessage = await submitCast(
      {
        text,
        parentUrl: await createCanonicalProposalUrl(chainId, proposalId),
      },
      { fid: Number(fid), network: FarcasterNetwork.MAINNET },
      new NobleEd25519Signer(hexToBytes(privateAccountKey)),
    );
    return jsonResponse(201, {
      hash: castMessage.hash,
      fid: castMessage.data.fid,
      timestamp: parseEpochTimestamp(castMessage.data.timestamp).toISOString(),
      text: castMessage.data.castAddBody.text,
    });
  } catch (e) {
    return jsonResponse(500, { error: "submit-failed" });
  }
}
