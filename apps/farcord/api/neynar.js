export const config = {
  runtime: "edge",
};

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const CORS_HEADERS = {
  // only allow request from farcord.com
  "Access-Control-Allow-Origin": "https://farcord.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request) {
  const queryParams = new URLSearchParams(request.url.split("?")[1]);

  const path = queryParams.get("path");
  const cache = queryParams.get("cache");

  const version = path.split("/")[1];
  const remainingPath = path.split("/").slice(2).join("/");

  // delete path and potential api_key from query params
  queryParams.delete("path");
  queryParams.delete("api_key");
  queryParams.delete("cache");

  queryParams.append("api_key", process.env.FARCASTER_HUB_API_KEY);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  const neynarApiEndpoint =
    version === "v1" ? NEYNAR_V1_ENDPOINT : NEYNAR_V2_ENDPOINT;

  const result = await fetch(
    `${neynarApiEndpoint}/${remainingPath}?` + queryParams,
    {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : null,
    },
  );

  const responseHeaders = {
    "Content-Type": "application/json",
    ...CORS_HEADERS,
  };

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch data from Neynar",
          resultStatus: `${result.status} ${result.statusText}`,
        },
      }),
      {
        status: 400,
        headers: responseHeaders,
      },
    );
  }

  const resultBody = await result.json();

  if (cache) responseHeaders["Cache-Control"] = `public, max-age=${cache}`;

  return new Response(JSON.stringify(resultBody), {
    status: 200,
    headers: responseHeaders,
  });
}
