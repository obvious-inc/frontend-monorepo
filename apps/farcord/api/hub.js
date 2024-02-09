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
  const path = urlParams.get("path");
  urlParams.delete("path");

  const url = process.env.FARCASTER_HUB_HTTP_ENDPOINT + path + "?" + urlParams;
  console.log("url", url);

  const hubRequest = new Request(url, {
    method: request.method,
    headers: { api_key: process.env.FARCASTER_HUB_API_KEY },
    body: request.body,
  });

  console.log(
    "hubRequest debug",
    hubRequest.url,
    hubRequest.method,
    hubRequest.headers.get("api_key"),
    hubRequest.body
  );

  return fetch(hubRequest)
    .then((res) => {
      console.log("result", res.status, res.statusText);
      if (!res.ok) {
        throw new Response(
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
      console.error("error", err);
      return err;
    });
}
