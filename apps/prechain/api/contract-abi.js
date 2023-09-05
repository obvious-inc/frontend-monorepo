export const config = {
  runtime: "edge",
};

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const ONE_MONTH_IN_SECONDS = ONE_DAY_IN_SECONDS * 30;

const etherscanRequest = (query) => {
  const searchParams = new URLSearchParams(query);
  return new Request(
    `https://api.etherscan.io/api?apikey=${process.env.ETHERSCAN_API_KEY}&${searchParams}`
  );
};

const abiCache = new Map();

const fetchAbi = async (address_) => {
  const address = address_.toLowerCase();

  if (abiCache.has(address)) return abiCache.get(address);

  const response = await fetch(
    etherscanRequest({
      module: "contract",
      action: "getabi",
      address,
    })
  );

  const responseBody = await response.json();

  if (responseBody.status !== "1") return null;

  const abi = JSON.parse(responseBody.result);

  abiCache.set(address, abi);

  return abi;
};

export default async (req) => {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (address == null)
    return new Response(JSON.stringify({ code: "address-required" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });

  const abi = await fetchAbi(address);

  if (abi == null)
    return new Response(JSON.stringify({ code: "not-found" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    });

  return new Response(JSON.stringify({ data: abi }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ONE_MONTH_IN_SECONDS}, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`,
    },
  });
};
