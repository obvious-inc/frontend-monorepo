export const config = {
  runtime: "edge",
};

const ONE_HOUR_IN_SECONDS = 60 * 60;
const ONE_WEEK_IN_SECONDS = ONE_HOUR_IN_SECONDS * 25 * 7;

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

  if (userResponse.status === 404)
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

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
      users.map((u) =>
        warpcastFetch(`/v2/verifications?fid=${u.fid}`).then((r) => r.json())
      )
    )
  ).flatMap((body) => body.result.verifications);

  return new Response(
    JSON.stringify({ results: verifications.map((v) => v.address) }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ONE_HOUR_IN_SECONDS}, stale-while-revalidate=${ONE_WEEK_IN_SECONDS}`,
      },
    }
  );
};
