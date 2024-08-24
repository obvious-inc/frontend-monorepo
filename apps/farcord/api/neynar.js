export const config = {
  runtime: "edge",
};

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

export default async function handler(request) {
  const queryParams = new URLSearchParams(request.url.split("?")[1]);

  // pop path from query params
  const path = queryParams.get("path");
  const version = path.split("/")[1];
  const remainingPath = path.split("/").slice(2).join("/");

  // delete path and potential api_key from query params
  queryParams.delete("path");
  queryParams.delete("api_key");

  const remainingQuery = queryParams.toString();

  console.log("version", version);
  console.log("path", remainingPath);
  console.log("query", remainingQuery);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  const neynarApiEndpoint =
    version === "v1" ? NEYNAR_V1_ENDPOINT : NEYNAR_V2_ENDPOINT;
  remainingQuery.append("api_key", process.env.FARCASTER_HUB_API_KEY);

  const result = await fetch(
    `${neynarApiEndpoint}/${remainingPath}?${remainingQuery}`,
    {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : null,
    }
  );

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch data from Neynar",
        },
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const resultBody = await result.json();

  return new Response(JSON.stringify(resultBody), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // console.log("body", body);

  // if (request.method === "POST") {
  //   // handle POST requests
  //   return new Response(
  //     JSON.stringify({
  //       data: {
  //         post: `version: ${version} | path: ${remainingPath} | query: ${remainingQuery}`,
  //       },
  //     }),
  //     {
  //       status: 200,
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );
  // } else {
  //   return new Response(
  //     JSON.stringify({
  //       data: {
  //         get: `version: ${version} | path: ${remainingPath}  | query: ${remainingQuery}`,
  //       },
  //     }),
  //     {
  //       status: 200,
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );
  // }
}
