export const config = {
  runtime: "edge",
};

const neynarApiKey = process.env.FARCASTER_HUB_API_KEY;
const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

// https://farcord-git-farcord-neynar-api-obvious.vercel.app/api/neynar?path=/v2/notifications&query=test
export default async function handler(request) {
  const queryParams = new URLSearchParams(request.url.split("?")[1]);

  // pop path from query params
  const path = queryParams.get("path");
  const version = path.split("/")[0];
  const remainingPath = path.split("/").slice(1).join("/");

  // delete path from query params
  queryParams.delete("path");

  const remainingQuery = queryParams.toString();

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  // console.log("body", body);

  if (request.method === "POST") {
    // handle POST requests
    return new Response(
      JSON.stringify({
        data: {
          post: `version: ${version} | path: ${remainingPath} | query: ${remainingQuery}`,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } else {
    return new Response(
      JSON.stringify({
        data: {
          get: `version: ${version} | path: ${remainingPath}  | query: ${remainingQuery}`,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
