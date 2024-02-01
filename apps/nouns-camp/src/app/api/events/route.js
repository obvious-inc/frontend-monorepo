import { track } from "@vercel/analytics/server";

export const runtime = "edge";

export async function POST(req, res) {
  const { name, data } = req.body;

  if (name == null)
    return Response.json({ code: "name-required" }, { status: 400 });

  await track(name, data);

  return res.code(200);
}
