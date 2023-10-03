import { decodeAbiParameters, encodeAbiParameters, parseAbiItem } from "viem";
import { contractAddressesByChainId } from "../store.js";

const CREATE_STREAM_SIGNATURE =
  "createStream(address,uint256,address,uint256,uint256,uint8,address)";

export const WETH_TOKEN_CONTRACT_ADDRESS =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const tokenByAddress = {
  "0x0000000000000000000000000000000000000000": "ETH",
  [WETH_TOKEN_CONTRACT_ADDRESS]: "WETH",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
};

const decodeCalldataWithSignature = ({ signature, calldata }) => {
  const { name, inputs: inputTypes } = parseAbiItem(`function ${signature}`);
  const inputs = decodeAbiParameters(inputTypes, calldata);

  return {
    name,
    inputs: inputs.map((value, i) => ({
      value,
      type: inputTypes[i]?.type,
    })),
  };
};

export const parse = (data, { chainId }) => {
  const contractAddresses = contractAddressesByChainId[chainId];

  const transactions = data.targets.map((target, i) => ({
    target,
    signature: data.signatures[i] || null,
    calldata: data.calldatas[i],
    value: BigInt(data.values[i]),
  }));

  const predictedStreamContractAddresses = transactions
    .filter((t) => t.signature === CREATE_STREAM_SIGNATURE)
    .map((t) => {
      const { inputs } = decodeCalldataWithSignature({
        signature: t.signature,
        calldata: t.calldata,
      });
      return inputs[6].value.toLowerCase();
    });

  return transactions.map(({ target, signature, calldata, value }) => {
    const isEthTransfer = signature == null && calldata === "0x";

    if (isEthTransfer)
      return target.toLowerCase() ===
        contractAddresses["token-buyer"]?.toLowerCase()
        ? { type: "token-buyer-top-up", value }
        : { type: "transfer", target, value };

    if (signature == null)
      return value > 0
        ? { type: "unparsed-payable-function-call", target, calldata, value }
        : { type: "unparsed-function-call", target, calldata };

    const { name: functionName, inputs: functionInputs } =
      decodeCalldataWithSignature({ signature, calldata });

    if (signature === CREATE_STREAM_SIGNATURE) {
      const tokenContractAddress = functionInputs[2].value.toLowerCase();
      return {
        type: "stream",
        receiverAddress: functionInputs[0].value.toLowerCase(),
        token: tokenByAddress[tokenContractAddress],
        tokenAmount: functionInputs[1].value,
        tokenContractAddress,
        startDate: new Date(Number(functionInputs[3].value) * 1000),
        endDate: new Date(Number(functionInputs[4].value) * 1000),
        streamContractAddress: functionInputs[6].value.toLowerCase(),
      };
    }

    if (target === WETH_TOKEN_CONTRACT_ADDRESS && signature === "deposit()") {
      return { type: "weth-deposit", value };
    }

    if (
      target === WETH_TOKEN_CONTRACT_ADDRESS &&
      signature === "transfer(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].value.toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress
      );

      return {
        type: isStreamFunding ? "weth-stream-funding" : "weth-transfer",
        target: functionInputs[0].value,
        value: BigInt(functionInputs[1].value),
      };
    }

    if (
      target.toLowerCase() === contractAddresses["payer"]?.toLowerCase() &&
      signature === "sendOrRegisterDebt(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].value.toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress
      );

      return {
        type: isStreamFunding
          ? "usdc-stream-funding-via-payer"
          : "usdc-transfer-via-payer",
        target: functionInputs[0].value,
        value: BigInt(functionInputs[1].value),
      };
    }

    if (value > 0)
      return {
        target,
        type: "payable-function-call",
        functionName,
        functionInputs,
        value,
      };

    return {
      target,
      type: "function-call",
      functionName,
      functionInputs,
    };
  });
};

export const unparse = (transactions, { chainId }) => {
  const contractAddresses = contractAddressesByChainId[chainId];
  return transactions.reduce(
    (acc, t) => {
      const append = (t) => ({
        targets: [...acc.targets, t.target],
        values: [...acc.values, t.value],
        signatures: [...acc.signatures, t.signature],
        calldatas: [...acc.calldatas, t.calldata],
      });

      switch (t.type) {
        case "transfer": {
          return append({
            target: t.target,
            value: t.value,
            signature: "",
            calldata: "0x",
          });
        }

        case "token-buyer-top-up":
          return append({
            target: contractAddresses["token-buyer"],
            value: t.value.toString(),
            signature: "",
            calldata: "0x",
          });

        case "usdc-transfer-via-payer":
          return append({
            target: contractAddresses["payer"],
            value: "0",
            signature: "sendOrRegisterDebt(address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }],
              [t.target, t.value]
            ),
          });

        case "function-call":
          return append({
            target: t.target,
            value: "0",
            signature: `${t.functionName}(${t.functionInputs
              .map((i) => i.type)
              .join(",")})`,
            calldata: encodeAbiParameters(
              t.functionInputs.map((i) => ({ type: i.type })),
              t.functionInputs.map((i) => i.value)
            ),
          });

        // TODO

        default:
          throw new Error(`Unknown transaction type "${t.type}"`);
      }
    },
    { targets: [], values: [], signatures: [], calldatas: [] }
  );
};

export const extractAmounts = (parsedTransactions) => {
  const ethTransfers = parsedTransactions.filter((t) => t.type === "transfer");
  const payableFunctionCalls = parsedTransactions.filter(
    (t) =>
      t.type === "payable-function-call" ||
      t.type === "unparsed-payable-function-call"
  );
  const wethTransfers = parsedTransactions.filter(
    (t) => t.type === "weth-transfer" || t.type === "weth-stream-funding"
  );
  const usdcTransfers = parsedTransactions.filter(
    (t) =>
      t.type === "usdc-transfer-via-payer" ||
      t.type === "usdc-stream-funding-via-payer"
  );

  const ethAmount = [...ethTransfers, ...payableFunctionCalls].reduce(
    (sum, t) => sum + t.value,
    BigInt(0)
  );
  const wethAmount = wethTransfers.reduce((sum, t) => sum + t.value, BigInt(0));
  const usdcAmount = usdcTransfers.reduce((sum, t) => sum + t.value, BigInt(0));

  return [
    { currency: "eth", amount: ethAmount },
    { currency: "weth", amount: wethAmount },
    { currency: "usdc", amount: usdcAmount },
  ].filter((e) => e.amount > 0);
};
