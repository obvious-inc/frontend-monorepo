const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

// create proxy server for neynar requests, get and post
export default async function handler(request, response) {
  let urlParams = new URLSearchParams(request.url.split("?")[1]);
  // add api key to params
  urlParams.set("api_key", process.env.FARCASTER_HUB_API_KEY);

  const url = NEYNAR_V2_ENDPOINT + "?" + urlParams;

  const neynarRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
  });

  const neynarResponse = await fetch(neynarRequest);
  const data = await neynarResponse.json();

  return response.status(neynarResponse.status).json({ data });
}
