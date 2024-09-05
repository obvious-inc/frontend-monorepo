// import { isLoggedIn, isLoggedInAccountFid } from "@/app/api/auth-utils";
// import { CHAIN_ID, APP_PRODUCTION_URL } from "../../../constants/env.js";
// import { subgraphFetch } from "../../../nouns-subgraph.js";
// import { parseEpochTimestamp } from "../../../utils/farcaster.js";
// import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
// import {
//   fetchCastsByParentUrl,
//   fetchAccount,
//   submitCastAdd,
// } from "../farcaster-utils.js";
// import {
//   getAccountKeyForFid,
//   deleteAccountKeyForFid,
// } from "../farcaster-account-key-utils.js";

export const runtime = "edge";

// const createCanonicalProposalUrl = async (proposalId) => {
//   const { proposal } = await subgraphFetch({
//     query: `
//       query {
//         proposal(id: ${proposalId}) {
//           createdTransactionHash
//         }
//       }`,
//   });
//
//   if (proposal == null) throw new Error();
//
//   return createTransactionReceiptUri(CHAIN_ID, proposal.createdTransactionHash);
// };

// const fetchProposalCasts = async (proposalId) => {
//   const url = await createCanonicalProposalUrl(proposalId);
//   const { accounts, casts } = await fetchCastsByParentUrl(url);
//   return { accounts, casts: casts.map((c) => ({ ...c, proposalId })) };
// };

// eslint-disable-next-line no-unused-vars
export async function GET(request) {
  // const { searchParams } = new URL(request.url);
  // const proposalId = searchParams.get("proposal");
  //
  // if (proposalId == null)
  //   return Response.json({ error: "proposal-required" }, { status: 400 });

  const { casts, accounts } = { casts: [], accounts: [] }; // await fetchProposalCasts(proposalId);

  return Response.json(
    { casts, accounts },
    {
      headers: {
        "Cache-Control": "max-age=10, stale-while-revalidate=20",
      },
    },
  );
}

// eslint-disable-next-line no-unused-vars
export async function POST(request) {
  // const { proposalId, text, fid } = await request.json();
  //
  // if (!(await isLoggedIn()))
  //   return Response.json({ error: "not-logged-in" }, { status: 401 });
  //
  // if (!(await isLoggedInAccountFid(fid)))
  //   return Response.json({ error: "address-not-verified" }, { status: 401 });
  //
  // const privateAccountKey = await getAccountKeyForFid(fid);
  //
  // if (privateAccountKey == null)
  //   return Response.json({ error: "no-account-key" }, { status: 401 });
  //
  // if (proposalId == null)
  //   return Response.json({ error: "proposal-required" }, { status: 400 });
  // if (text == null)
  //   return Response.json({ error: "text-required" }, { status: 400 });
  //
  // try {
  //   const account = await fetchAccount(fid);
  //   const castMessage = await submitCastAdd(
  //     { fid, privateAccountKey },
  //     {
  //       text,
  //       parentUrl: await createCanonicalProposalUrl(proposalId),
  //       embeds: [{ url: `${APP_PRODUCTION_URL}/proposals/${proposalId}` }],
  //     },
  //   );
  //   return Response.json(
  //     {
  //       hash: castMessage.hash,
  //       fid: castMessage.data.fid,
  //       timestamp: parseEpochTimestamp(
  //         castMessage.data.timestamp,
  //       ).toISOString(),
  //       text: castMessage.data.castAddBody.text,
  //       account,
  //     },
  //     { status: 201 },
  //   );
  // } catch (e) {
  //   // Delete revoked key
  //   if (e.message === "invalid-account-key") {
  //     await deleteAccountKeyForFid(fid);
  //     return Response.json({ error: "invalid-account-key" }, { status: 401 });
  //   }
    return Response.json({ error: "submit-failed" }, { status: 500 });
  // }
}
