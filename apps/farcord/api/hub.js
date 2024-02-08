export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  console.log("redirecting request...");
  // redirect request to the hub and add the api key header
  console.log("request", request, typeof request, request instanceof Request);
  console.log("request headers", request.headers);
  console.log("request url", request.url);
  console.log("og path", request.path);
  const requestPath = request.path?.replace(/^\/hub/, "");
  console.log("new path", requestPath);

  const headers = new Headers(request.headers);

  return fetch(process.env.FARCASTER_HUB_HTTP_ENDPOINT + requestPath, {
    method: request.method,
    body: request.body,
    headers: {
      ...Object.fromEntries(headers),
      api_key: process.env.FARCASTER_HUB_API_KEY,
    },
  });
}
