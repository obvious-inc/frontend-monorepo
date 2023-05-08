import { decodeFunctionData } from "viem";

export const config = {
  runtime: "edge",
};

const etherscanRequest = (query) => {
  const searchParams = new URLSearchParams(query);
  return new Request(
    `https://api.etherscan.io/api?apikey=${process.env.ETHERSCAN_API_KEY}&${searchParams}`
  );
};

const parseCamelCasedString = (str) => {
  const parsed = str.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    (matchCapitalLetter, matchOffset) =>
      `${matchOffset === 0 ? "" : " "}${matchCapitalLetter.toLowerCase()}`
  );
  return `${parsed[0].toUpperCase()}${parsed.slice(1)}`;
};

const parseTransaction = (tx) => {
  const functionSignature = tx.functionName === "" ? null : tx.functionName;
  return {
    hash: tx.hash,
    timestamp: tx.timeStamp,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    functionSignature,
    description:
      functionSignature == null
        ? null
        : parseCamelCasedString(
            functionSignature.slice(0, functionSignature.indexOf("("))
          ),
  };
};

const abiCache = new Map();

const fetchAbi = async (address) => {
  if (abiCache.has(address)) return abiCache.get(address);

  const abiResponseBody = await (
    await fetch(
      etherscanRequest({
        module: "contract",
        action: "getabi",
        address,
      })
    )
  ).json();

  if (abiResponseBody.status !== "1") return null;

  const abi = JSON.parse(abiResponseBody.result);

  abiCache.set(address, abi);

  return abi;
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

  const transactions = [];

  for (const tx of responseBody.result) {
    const parsedTransaction = parseTransaction(tx);
    const inputData = tx.input;

    if (inputData === "0x") {
      transactions.push(parseTransaction);
      continue;
    }

    const abi = await fetchAbi(tx.to);

    if (abi == null) {
      transactions.push(parseTransaction);
      continue;
    }

    try {
      const { functionName, args } = decodeFunctionData({
        abi: abi,
        data: inputData,
      });
      const functionAbi = abi.find(
        (e) => e.type === "function" && e.name === functionName
      );
      const parsedInput = functionAbi.inputs.map((input, i) => {
        const rawValue = args[i];
        const value =
          typeof rawValue === "bigint" ? rawValue.toString() : rawValue;
        return { ...input, value };
      });
      transactions.push({ ...parsedTransaction, parsedInput });
    } catch (e) {
      transactions.push(parseTransaction);
    }
  }

  return new Response(JSON.stringify({ results: transactions }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
};
