export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  console.log("redirecting request...");

  console.log("request url", request.url);

  let url = new URL(request.url);
  url.hostname = process.env.FARCASTER_HUB_HTTP_ENDPOINT;

  console.log("new url", url.toString());

  const headers = new Headers(request.headers);
  return;

  return fetch(requestUrlString, {
    method: request.method,
    body: request.body,
    headers: {
      ...Object.fromEntries(headers),
      api_key: process.env.FARCASTER_HUB_API_KEY,
    },
  });
}
