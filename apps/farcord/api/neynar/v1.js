export const config = {
  runtime: "edge",
};

const neynarApiKey = process.env.FARCASTER_HUB_API_KEY;

export default async function handler(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  console.log("body", body);

  if (request.method === "POST") {
    // handle POST requests
    return new Response(
      JSON.stringify({
        data: { post: "ok v1" },
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
          get: "ok v1",
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
