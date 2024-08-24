export default function handler(request, response) {
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

  const hubRequest = new Request(url, { method, headers, body });

  return fetch(hubRequest)
    .then((res) => {
      if (!res.ok) {
        return response.status(res.status).json({ error: res.statusText });
      }

      return res.json();
    })
    .then((data) => {
      return response
        .status(200, {
          headers: {
            "Cache-Control": cache ? `public, max-age=${cache}` : null,
          },
        })
        .json(data);
    })
    .catch((err) => {
      return err;
    });
}
