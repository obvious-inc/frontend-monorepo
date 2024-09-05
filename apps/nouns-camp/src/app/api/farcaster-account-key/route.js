// import { getPublicKeyAsync, utils as EdDSAUtils } from "@noble/ed25519";
// import { bytesToHex } from "viem";
// import { privateKeyToAccount } from "viem/accounts";
// import {
//   persistPendingAccountKeyForFid,
//   setPendingAccountKey,
// } from "../farcaster-account-key-utils";

export const runtime = "edge";

// const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
//   name: "Farcaster SignedKeyRequestValidator",
//   version: "1",
//   chainId: 10,
//   verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
// };

// const SIGNED_KEY_REQUEST_TYPE = [
//   { name: "requestFid", type: "uint256" },
//   { name: "key", type: "bytes" },
//   { name: "deadline", type: "uint256" },
// ];

// const campAccount = privateKeyToAccount(
//   process.env.CAMP_FARCASTER_ACCOUNT_PRIVATE_KEY,
// );

// const createSignerKeyPair = async () => {
//   const signerPrivateKey = EdDSAUtils.randomPrivateKey();
//   const publicKey = await getPublicKeyAsync(signerPrivateKey);
//   return {
//     privateKey: bytesToHex(signerPrivateKey),
//     publicKey: bytesToHex(publicKey),
//   };
// };

// const createSignedKeyRequest = async (publicKey) => {
//   // 1 hour deadline
//   const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60;
//
//   const signature = await campAccount.signTypedData({
//     domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
//     types: { SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE },
//     primaryType: "SignedKeyRequest",
//     message: {
//       requestFid: Number(process.env.CAMP_FARCASTER_ACCOUNT_FID),
//       key: publicKey,
//       deadline,
//     },
//   });
//
//   const response = await fetch(
//     "https://api.neynar.com/v2/farcaster/signer/developer_managed/signed_key",
//     {
//       method: "POST",
//       headers: {
//         api_key: process.env.NEYNAR_API_KEY,
//         "Content-Type": "application/json",
//         accept: "application/json",
//       },
//       body: JSON.stringify({
//         public_key: publicKey,
//         app_fid: Number(process.env.CAMP_FARCASTER_ACCOUNT_FID),
//         signature,
//         deadline,
//       }),
//     },
//   );
//
//   const body = await response.json();
//
//   if (!response.ok) {
//     console.error(body);
//     throw new Error();
//   }
//
//   return {
//     key: body.public_key,
//     fid: body.fid,
//     status: body.status,
//     signerApprovalUrl: body.signer_approval_url,
//   };
// };

// const fetchAccountKey = async (publicKey) => {
//   const response = await fetch(
//     `https://api.neynar.com/v2/farcaster/signer/developer_managed?public_key=${publicKey}`,
//     {
//       headers: {
//         accept: "application/json",
//         api_key: process.env.NEYNAR_API_KEY,
//       },
//     },
//   );
//
//   const body = await response.json();
//
//   if (!response.ok) {
//     console.error(body);
//     throw new Error();
//   }
//
//   return {
//     key: body.public_key,
//     fid: body.fid,
//     status: body.status,
//     signerApprovalUrl: body.signer_approval_url,
//   };
// };

export async function POST() {
  // const { publicKey, privateKey } = await createSignerKeyPair();
  //
  // const keyRequest = await createSignedKeyRequest(publicKey);
  //
  // await setPendingAccountKey({ publicKey, privateKey });

  return Response.json({} /*keyRequest*/);
}

// eslint-disable-next-line no-unused-vars
export async function GET(request) {
  // const { searchParams } = new URL(request.url);
  // const publicKey = searchParams.get("key");
  //
  // const { key, fid, status, signerApprovalUrl } =
  //   await fetchAccountKey(publicKey);
  //
  // if (status !== "approved")
  //   return Response.json({ key, status, signerApprovalUrl });
  //
  // await persistPendingAccountKeyForFid({ publicKey: key, fid });

  return Response.json({} /*{ key, fid, status }*/);
}
