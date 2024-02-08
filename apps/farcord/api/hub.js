export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  console.log("redirecting request...");

  console.log("request url", request.url);
  const requestUrl = new URL(request.url);

  requestUrl.hostname = process.env.FARCASTER_HUB_HTTP_ENDPOINT;

  let requestUrlString = requestUrl.toString();
  requestUrlString = requestUrlString.replace(/^\/hub/, "");

  //   const requestPath = url.path?.replace(/^\/hub/, "");
  console.log("new path", requestUrlString);

  const headers = new Headers(request.headers);

  return fetch(requestUrlString, {
    method: request.method,
    body: request.body,
    headers: {
      ...Object.fromEntries(headers),
      api_key: process.env.FARCASTER_HUB_API_KEY,
    },
  });
}
