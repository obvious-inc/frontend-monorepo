export const runtime = "edge";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const ONE_MONTH_IN_SECONDS = ONE_DAY_IN_SECONDS * 30;

const etherscanRequest = (query) => {
  const searchParams = new URLSearchParams(query);
  return new Request(
    `https://api.etherscan.io/api?apikey=${process.env.ETHERSCAN_API_KEY}&${searchParams}`
  );
};

const contractInfoCache = new Map();

const fetchAbi = async (address) => {
  const response = await fetch(
    etherscanRequest({
      module: "contract",
      action: "getabi",
      address,
    })
  );

  const responseBody = await response.json();

  if (responseBody.status !== "1") {
    const error = new Error();
    error.code = "implementation-abi-not-found";
    return Promise.reject(error);
  }

  return JSON.parse(responseBody.result);
};

const fetchContractInfo = async (address_) => {
  const address = address_.toLowerCase();

  if (contractInfoCache.has(address)) return contractInfoCache.get(address);

  const response = await fetch(
    etherscanRequest({
      module: "contract",
      action: "getsourcecode",
      address,
    })
  );

  const responseBody = await response.json();

  if (responseBody.status !== "1" || responseBody.result.length === 0)
    throw new Error();

  if (responseBody.result[0]["SourceCode"] === "") {
    const error = new Error();
    error.code = "contract-address-required";
    return Promise.reject(error);
  }

  if (responseBody.result[0]["ABI"] === "Contract source code not verified") {
    const error = new Error();
    error.code = "source-code-not-verified";
    return Promise.reject(error);
  }

  const contractInfo = {
    name: responseBody.result[0]["ContractName"],
    abi: JSON.parse(responseBody.result[0]["ABI"]),
    isProxy: responseBody.result[0]["Proxy"] === "1",
  };

  if (contractInfo.isProxy) {
    const implementationAddress = responseBody.result[0]["Implementation"];
    contractInfo.implementationAddress = implementationAddress;
    contractInfo.implementationAbi = await fetchAbi(implementationAddress);
  }

  contractInfoCache.set(address, contractInfo);

  return contractInfo;
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (address == null)
    return Response.json({ code: "address-required" }, { status: 400 });

  try {
    const contractInfo = await fetchContractInfo(address);

    // if (contractInfo == null)
    //   return new Response(JSON.stringify({ code: "not-found" }), {
    //     status: 404,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //   });

    return Response.json(
      { data: contractInfo },
      {
        headers: {
          "Cache-Control": `public, max-age=${ONE_MONTH_IN_SECONDS}, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`,
        },
      }
    );
  } catch (e) {
    console.error(e);
    return Response.json(
      { code: e.code ?? "unexpected-error" },
      { status: 500 }
    );
  }
}
