import { fetchCastReplies } from "@/app/api/farcaster-utils";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (hash == null)
    return Response.json({ error: "hash-required" }, { status: 400 });

  const { casts, accounts } = await fetchCastReplies(hash);

  return Response.json(
    { casts, accounts },
    {
      status: 200,
      headers: {
        "Cache-Control": "max-age=10, s-max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
