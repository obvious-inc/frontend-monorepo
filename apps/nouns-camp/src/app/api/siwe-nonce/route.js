import { generateSiweNonce } from "viem/siwe";
import { getSession } from "@/utils/session";

export async function GET() {
  const session = await getSession();
  const nonce = generateSiweNonce();
  session["siwe-nonce"] = nonce;
  await session.save();

  return new Response(nonce, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
