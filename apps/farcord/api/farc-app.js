export const config = {
  runtime: "edge",
};

import { mnemonicToAccount } from "viem/accounts";

const appAccount = mnemonicToAccount(process.env.FARCORD_APP_MNEMONIC);

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: "Farcaster SignedKeyRequestValidator",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
};

const SIGNED_KEY_REQUEST_TYPE = [
  { name: "requestFid", type: "uint256" },
  { name: "key", type: "bytes" },
  { name: "deadline", type: "uint256" },
];

export default async (req) => {
  console.log("new request coming through", req);

  if (req.method === "POST") {
    const { body } = req;
    console.log("body", body);

    const { key, deadline } = body;
    console.log("key", key);
    console.log("deadline", deadline);

    const signature = await appAccount.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: "SignedKeyRequest",
      message: {
        requestFid: Number(process.env.FARCORD_APP_FID),
        key: key,
        deadline: deadline,
      },
    });

    console.log("sig", signature);

    return new Response(
      JSON.stringify({
        data: { signature: signature },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } else {
    return new Response(
      JSON.stringify({
        data: { address: appAccount.address, fid: process.env.FARCORD_APP_FID },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
