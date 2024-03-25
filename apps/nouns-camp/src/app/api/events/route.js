import { track } from "@vercel/analytics/server";

export const runtime = "edge";

export async function POST(request) {
  const { name, data } = await request.json();

  if (name == null)
    return Response.json({ code: "name-required" }, { status: 400 });

  await track(name, data);

  return new Response(null, { status: 200 });
}
