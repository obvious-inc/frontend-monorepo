import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

const ONE_WEEK_IN_SECONDS = 60 * 60 * 40 * 6;

export const getSession = () =>
  getIronSession(cookies(), {
    cookieName: "session",
    password: process.env.SESSION_SEAL_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ONE_WEEK_IN_SECONDS,
      path: "/",
    },
  });
