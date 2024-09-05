import { invariant } from "@shades/common/utils";
import { getSession } from "@/utils/session";
import { verifyEthAddress } from "./farcaster-utils.js";

export const isLoggedIn = async () => {
  const session = await getSession();
  return session.address != null;
};

export const isLoggedInAccountFid = async (fid) => {
  const session = await getSession();
  invariant(session.address != null, "Not logged in");
  invariant(fid != null, "FID missing");
  const isVerifiedAddress = await verifyEthAddress(fid, session.address);
  return isVerifiedAddress;
};
