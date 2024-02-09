export default function handler(request, response) {
  const headers = new Headers(request.headers);
  headers.set("api_key", process.env.FARCASTER_HUB_API_KEY);

  // remove path from query parameters and use as part of URL
  const urlParams = new URLSearchParams(request.url.split("?")[1]);
  const path = urlParams.get("path");
  urlParams.delete("path");

  const url = process.env.FARCASTER_HUB_HTTP_ENDPOINT + path + "?" + urlParams;

  const hubRequest = new Request(url, {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  return fetch(hubRequest)
    .then((res) => {
      if (!res.ok) {
        return response.status(res.status).json({ error: res.statusText });
      }

      return res.json();
    })
    .then((data) => {
      return response.status(200).json(data);
    })
    .catch((err) => {
      return err;
    });
}
