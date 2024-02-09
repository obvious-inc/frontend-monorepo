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
  return fetch(process.env.FARCASTER_HUB_HTTP_ENDPOINT + request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
    .then((res) => {
      console.log("result", res);
      return res.json();
    })
    .then((data) => {
      return response.json(data);
    })
    .catch((err) => {
      console.error(err);
      return response.json({ error: err.message });
    });
}
