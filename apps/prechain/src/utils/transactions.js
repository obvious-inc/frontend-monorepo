import { formatAbiParameters } from "abitype";
import { decodeAbiParameters, encodeAbiParameters, parseAbiItem } from "viem";
import { resolveAddress, resolveIdentifier } from "../contracts.js";

const CREATE_STREAM_SIGNATURE =
  "createStream(address,uint256,address,uint256,uint256,uint8,address)";

const decodeCalldataWithSignature = ({ signature, calldata }) => {
  try {
    const { name, inputs: inputTypes } = parseAbiItem(`function ${signature}`);
    if (inputTypes.length === 0) return { name, inputs: [] };

    try {
      const inputs = decodeAbiParameters(inputTypes, calldata);
      return {
        name,
        inputs: inputs.map((value, i) => ({
          value,
          type: inputTypes[i]?.type,
        })),
      };
    } catch (e) {
      return { name, calldataDecodingFailed: true };
    }
  } catch (e) {
    return {
      name: signature,
      signatureDecodingFailed: true,
      calldataDecodingFailed: true,
    };
  }
};

export const parse = (data, { chainId }) => {
  const nounsPayerContract = resolveIdentifier(chainId, "payer");
  const nounsTokenBuyerContract = resolveIdentifier(chainId, "token-buyer");
  const wethTokenContract = resolveIdentifier(chainId, "weth-token");

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
        nounsTokenBuyerContract.address.toLowerCase()
        ? { type: "token-buyer-top-up", target, value }
        : { type: "transfer", target, value };

    if (signature == null)
      return value > 0
        ? { type: "unparsed-payable-function-call", target, calldata, value }
        : { type: "unparsed-function-call", target, calldata };

    const {
      name: functionName,
      inputs: functionInputs,
      calldataDecodingFailed,
    } = decodeCalldataWithSignature({ signature, calldata });

    if (calldataDecodingFailed)
      return {
        type: "unparsed-function-call",
        target,
        signature,
        calldata,
        value,
        error: "calldata-decoding-failed",
      };

    if (signature === CREATE_STREAM_SIGNATURE) {
      const tokenContractAddress = functionInputs[2].value.toLowerCase();
      const tokenContract = resolveAddress(chainId, tokenContractAddress);
      return {
        type: "stream",
        target,
        functionName,
        functionInputs,
        receiverAddress: functionInputs[0].value.toLowerCase(),
        token: tokenContract.token,
        tokenAmount: functionInputs[1].value,
        tokenContractAddress,
        startDate: new Date(Number(functionInputs[3].value) * 1000),
        endDate: new Date(Number(functionInputs[4].value) * 1000),
        streamContractAddress: functionInputs[6].value.toLowerCase(),
      };
    }

    if (
      target.toLowerCase() === wethTokenContract.address.toLowerCase() &&
      functionName === "deposit"
    ) {
      return {
        type: "weth-deposit",
        target,
        functionName,
        functionInputs,
        value,
      };
    }

    if (
      target.toLowerCase() === wethTokenContract.address.toLowerCase() &&
      functionName === "approve"
    ) {
      return {
        type: "weth-approval",
        target,
        functionName,
        functionInputs,
        receiverAddress: functionInputs[0].value,
        wethAmount: BigInt(functionInputs[1].value),
      };
    }

    if (
      target.toLowerCase() === wethTokenContract.address.toLowerCase() &&
      signature === "transfer(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].value.toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress
      );

      return {
        type: isStreamFunding ? "weth-stream-funding" : "weth-transfer",
        target,
        functionName,
        functionInputs,
        receiverAddress: functionInputs[0].value,
        wethAmount: BigInt(functionInputs[1].value),
      };
    }

    if (
      target.toLowerCase() === nounsPayerContract.address.toLowerCase() &&
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
        target,
        functionName,
        functionInputs,
        receiverAddress: functionInputs[0].value,
        usdcAmount: BigInt(functionInputs[1].value),
      };
    }

    if (value > 0)
      return {
        type: "payable-function-call",
        target,
        functionName,
        functionInputs,
        value,
      };

    return {
      type: "function-call",
      target,
      functionName,
      functionInputs,
    };
  });
};

export const unparse = (transactions, { chainId }) => {
  const wethTokenContract = resolveIdentifier(chainId, "weth-token");
  const nounsPayerContract = resolveIdentifier(chainId, "payer");
  const nounsTokenBuyerContract = resolveIdentifier(chainId, "token-buyer");
  const nounsStreamFactoryContract = resolveIdentifier(
    chainId,
    "stream-factory"
  );

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
            target: nounsTokenBuyerContract.address,
            value: t.value.toString(),
            signature: "",
            calldata: "0x",
          });

        case "usdc-transfer-via-payer":
          return append({
            target: nounsPayerContract.address,
            value: "0",
            signature: "sendOrRegisterDebt(address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }],
              [t.receiverAddress, t.usdcAmount]
            ),
          });

        case "weth-deposit":
          return append({
            target: wethTokenContract.address,
            value: t.value,
            signature: "deposit()",
            calldata: "0x",
          });

        case "weth-transfer":
        case "weth-stream-funding":
          return append({
            target: wethTokenContract.address,
            value: "0",
            signature: "transfer(address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }],
              [t.receiverAddress, t.wethAmount]
            ),
          });

        case "stream": {
          const tokenContract = resolveIdentifier(
            chainId,
            `${t.token.toLowerCase()}-token`
          );
          return append({
            target: nounsStreamFactoryContract.address,
            value: "0",
            signature: CREATE_STREAM_SIGNATURE,
            calldata: encodeAbiParameters(
              [
                "address",
                "uint256",
                "address",
                "uint256",
                "uint256",
                "uint8",
                "address",
              ].map((type) => ({ type })),
              [
                t.receiverAddress,
                t.tokenAmount,
                tokenContract.address,
                t.startDate.getTime() / 1000,
                t.endDate.getTime() / 1000,
                0,
                t.streamContractAddress,
              ]
            ),
          });
        }

        case "function-call":
        case "payable-function-call": {
          const formattedInputs = formatAbiParameters(t.functionInputs);
          const signature = `${t.functionName}(${formattedInputs})`;
          return append({
            target: t.target,
            value: t.type === "payable-function-call" ? t.value : "0",
            signature,
            calldata: encodeAbiParameters(
              t.functionInputs,
              t.functionInputs.map((i) => i.value)
            ),
          });
        }

        case "unparsed-function-call":
        case "unparsed-payable-function-call":
          return append({
            target: t.target,
            value: t.value ?? "0",
            signature: t.signature ?? "",
            calldata: t.calldata ?? "0x",
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
  const ethTransfersAndPayableCalls = parsedTransactions.filter(
    (t) =>
      // Exclude Token Buyer top ups
      t.type !== "token-buyer-top-up" &&
      // Exclude WETH deposits as these are handled separately
      t.type !== "weth-deposit" &&
      t.value != null
  );
  const wethTransfers = parsedTransactions.filter(
    (t) =>
      t.type === "weth-transfer" ||
      t.type === "weth-approval" ||
      t.type === "weth-stream-funding"
  );
  const usdcTransfers = parsedTransactions.filter(
    (t) =>
      t.type === "usdc-transfer-via-payer" ||
      t.type === "usdc-stream-funding-via-payer"
  );

  const ethAmount = ethTransfersAndPayableCalls.reduce(
    (sum, t) => sum + t.value,
    BigInt(0)
  );
  const wethAmount = wethTransfers.reduce(
    (sum, t) => sum + t.wethAmount,
    BigInt(0)
  );
  const usdcAmount = usdcTransfers.reduce(
    (sum, t) => sum + t.usdcAmount,
    BigInt(0)
  );

  return [
    { currency: "eth", amount: ethAmount },
    { currency: "weth", amount: wethAmount },
    { currency: "usdc", amount: usdcAmount },
  ].filter((e) => e.amount > 0);
};
