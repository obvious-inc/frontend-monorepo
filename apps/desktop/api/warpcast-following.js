export const config = {
  runtime: "edge",
};

const warpcastFetch = (url) =>
  fetch(`https://api.warpcast.com${url}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${process.env.WARPCAST_APPLICATION_BEARER_TOKEN}`,
    },
  });

export default async (req) => {
  const { searchParams } = new URL(req.url);

  const walletAddress = searchParams.get("wallet-address");

  if (walletAddress == null)
    return new Response(
      JSON.stringify({ error: "`wallet-address` search parameter required" }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      }
    );

  const userResponse = await warpcastFetch(
    `/v2/user-by-verification?address=${walletAddress}`
  );

  if (!userResponse.ok) return userResponse;

  const userResponseBody = await userResponse.json();

  const fid = userResponseBody.result?.user.fid;

  if (fid == null)
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

  const followingResponse = await warpcastFetch(`/v2/following?fid=${fid}`);

  if (!followingResponse.ok) return followingResponse;

  const followingResponseBody = await followingResponse.json();

  const { users } = followingResponseBody.result;

  const verifications = (
    await Promise.all(
      (
        await Promise.all(
          users.map((u) => warpcastFetch(`/v2/verifications?fid=${u.fid}`))
        )
      ).map((r) => r.json())
    )
  ).flatMap((body) => body.result.verifications);

  return new Response(JSON.stringify({ results: verifications }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
};
