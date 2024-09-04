import { createPublicClient, http } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { CHAIN_ID, APP_HOST } from "@/constants/env";
import { getJsonRpcUrl } from "@/wagmi-config";
import { getChain } from "@/utils/chains";
import { getSession } from "@/utils/session";

export async function POST(request) {
  const { message, signature } = await request.json();

  const chain = getChain(CHAIN_ID);

  const publicClient = createPublicClient({
    chain,
    transport: http(getJsonRpcUrl(chain.id)),
  });

  const isValidSignature = await publicClient.verifySiweMessage({
    message,
    signature,
  });

  if (!isValidSignature)
    return Response.json({ error: "invalid-signature" }, { status: 401 });

  const session = await getSession();

  const siweMessageFields = parseSiweMessage(message);

  const isValidMessage = validateSiweMessage({
    message: siweMessageFields,
    domain: APP_HOST,
    nonce: session["siwe-nonce"],
  });

  if (!isValidMessage) {
    return Response.json({ error: "invalid-message" }, { status: 401 });
  }

  session.address = siweMessageFields.address.toLowerCase();
  await session.save();
  return Response.json(session, { status: 201 });
}

export async function PATCH() {
  const session = await getSession();
  session.save(); // Resets expiry
  return Response.json({ address: session.address });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return new Response(null, { status: 200 });
}
