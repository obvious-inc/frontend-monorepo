export const config = {
  runtime: "edge",
};

import { mnemonicToAccount } from "viem/accounts";

const appAccount = mnemonicToAccount(process.env.FARCORD_APP_MNEMONIC);

export default async (req) => {
  console.log("new request coming through", req);
  console.log("account", appAccount.address);
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (address == null)
    return new Response(JSON.stringify({ code: "address-required" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });

  return new Response(JSON.stringify({ data: { status: "ok" } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
