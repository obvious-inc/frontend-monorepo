import { hexToBytes } from "viem";
import { isLoggedIn, isLoggedInAccountFid } from "@/app/api/auth-utils";
import { parseEpochTimestamp } from "@/utils/farcaster";
import { submitCastAdd, fetchAccount } from "@/app/api/farcaster-utils";
import {
  getAccountKeyForFid,
  deleteAccountKeyForFid,
} from "@/app/api/farcaster-account-key-utils";

export async function POST(request) {
  const { targetCastId, text, fid } = await request.json();

  if (!(await isLoggedIn()))
    return Response.json({ error: "not-logged-in" }, { status: 401 });

  if (!(await isLoggedInAccountFid(fid)))
    return Response.json({ error: "address-not-verified" }, { status: 401 });

  const privateAccountKey = await getAccountKeyForFid(fid);

  if (privateAccountKey == null)
    return Response.json({ error: "no-account-key" }, { status: 401 });

  if (targetCastId == null)
    return Response.json({ error: "target-cast-id-required" }, { status: 400 });

  if (text == null)
    return Response.json({ error: "text-required" }, { status: 400 });

  try {
    const account = await fetchAccount(fid);
    const castMessage = await submitCastAdd(
      { fid, privateAccountKey },
      {
        text,
        parentCastId: {
          fid: targetCastId.fid,
          hash: hexToBytes(targetCastId.hash),
        },
      },
    );
    return Response.json(
      {
        hash: castMessage.hash,
        fid: castMessage.data.fid,
        timestamp: parseEpochTimestamp(
          castMessage.data.timestamp,
        ).toISOString(),
        text: castMessage.data.castAddBody.text,
        account,
      },
      { status: 201 },
    );
  } catch (e) {
    // Delete revoked key
    if (e.message === "invalid-account-key") {
      await deleteAccountKeyForFid(fid);
      return Response.json({ error: "invalid-account-key" }, { status: 401 });
    }
    console.error(e);
    return Response.json({ error: "submit-failed" }, { status: 500 });
  }
}
