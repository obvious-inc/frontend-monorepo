export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  const headers = new Headers(request.headers);
  headers.set("api_key", process.env.FARCASTER_HUB_API_KEY);

  // remove path from query parameters and use as part of URL
  const urlParams = new URLSearchParams(request.url.split("?")[1]);
  const path = urlParams.get("path");
  const cache = urlParams.get("cache");

  console.log("url params", urlParams.toString());
  console.log("cache", cache);

  urlParams.delete("path");
  urlParams.delete("cache");

  const url = process.env.FARCASTER_HUB_HTTP_ENDPOINT + path + "?" + urlParams;

  let { method, body } = request;

  // the dev server sends "" bodies on GET requests, maybe?
  if (["GET", "HEAD"].includes(method)) {
    body = null;
  }

  console.log("url", url);
  console.log("method", method);
  console.log("body", body);
  console.log("headers", headers);

  const result = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: {
          status: result.status,
          statusText: result.statusText,
        },
      }),
      {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const data = await result.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cache ? `public, max-age=${cache}` : null,
    },
  });
}
