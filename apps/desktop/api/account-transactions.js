export const config = {
  runtime: "edge",
};

const etherscanRequest = (query) => {
  const searchParams = new URLSearchParams(query);
  return new Request(
    `https://api.etherscan.io/api?apikey=${process.env.ETHERSCAN_API_KEY}&${searchParams}`
  );
};

export default async (req) => {
  const { searchParams } = new URL(req.url);
  const accountAddress = searchParams.get("account-address");

  if (accountAddress == null)
    return new Response(
      JSON.stringify({
        code: "missing-argument",
        message: "`account-address` search parameter required",
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      }
    );

  const response = await fetch(
    etherscanRequest({
      module: "account",
      action: "txlist",
      address: accountAddress,
      startBlock: 0,
      endBlock: 99999999,
      page: searchParams.get("page") ?? 1,
      sort: "desc",
      offset: 50, // Page size
    })
  );

  if (!response.ok) return response;

  const responseBody = await response.json();

  return new Response(JSON.stringify({ results: responseBody.result }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
};
