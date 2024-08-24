export const config = {
  runtime: "edge",
};

const neynarApiKey = process.env.FARCASTER_HUB_API_KEY;

export default async function handler(request) {
  const path = new URL(request.url).pathname;
  const version = path.split("/")[0];
  const remainingPath = path.split("/").slice(1).join("/");

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
        data: { post: `version: ${version} | path: ${remainingPath}` },
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
          get: `version: ${version} | path: ${remainingPath}`,
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
