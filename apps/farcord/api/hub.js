export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // redirect request to the hub and add the api key header
  const requestPath = request.path.replace(/^\/hub/, "");
  return fetch(process.env.FARCASTER_HUB_HTTP_ENDPOINT + requestPath, {
    headers: {
      api_key: process.env.FARCASTER_HUB_API_KEY,
    },
  });
}
