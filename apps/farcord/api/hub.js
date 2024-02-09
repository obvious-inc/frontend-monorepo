export const config = {
  runtime: "edge",
};

export default async function handler(request, response) {
  console.log(
    "handling /hub request",
    request.url,
    request.method,
    request.headers,
    request.body
  );

  // remove path from query parameters and use as part of URL
  const urlParams = new URLSearchParams(request.url.split("?")[1]);
  console.log("url params", urlParams.toString());

  const path = urlParams.get("path");
  urlParams.delete("path");

  const url = process.env.FARCASTER_HUB_HTTP_ENDPOINT + path + "?" + urlParams;
  console.log("url", url);

  return fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
    .then((res) => {
      console.log("result", res.status, res.statusText);
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: res.statusText,
          }),
          {
            status: res.status,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      return res.json();
    })
    .then((data) => {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    })
    .catch((err) => {
      console.error(err);
      return response.json({ error: err.message });
    });
}
