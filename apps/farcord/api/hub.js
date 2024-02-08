export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  console.log("redirecting request...");

  console.log("request url", request.url);

  let replacedUrl = request.url.replace(
    request.url.hostname,
    process.env.FARCASTER_HUB_HTTP_ENDPOINT
  );
  console.log("replaced url", replacedUrl);

  const requestUrlString = replacedUrl.replace(/^\/hub/, "");

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
