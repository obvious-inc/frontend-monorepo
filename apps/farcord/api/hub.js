export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  console.log("redirecting request...");
  // redirect request to the hub and add the api key header
  console.log("og path", request.path);
  const requestPath = request.path?.replace(/^\/hub/, "");
  console.log("new path", requestPath);

  return fetch(process.env.FARCASTER_HUB_HTTP_ENDPOINT + requestPath, {
    method: request.method,
    body: request.body,
    headers: {
      api_key: process.env.FARCASTER_HUB_API_KEY,
    },
  });
}
