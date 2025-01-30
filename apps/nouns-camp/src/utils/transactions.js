import {
  decodeAbiParameters,
  encodeAbiParameters,
  parseAbiItem,
  parseUnits,
  parseEther,
  formatUnits,
  formatEther,
  isHex,
} from "viem";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { resolveAddress, resolveIdentifier } from "../contracts.js";

const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

export const createSignature = ({ functionName, inputTypes }) => {
  const stringifyTuple = ({ components }) =>
    `(${components.map(stringifyType).join(",")})`;
  const stringifyType = ({ type, components }) => {
    if (type === "tuple") return stringifyTuple({ components });
    if (type === "tuple[]") return `${stringifyTuple({ components })}[]`;
    return type;
  };
  const formattedInputs = inputTypes?.map(stringifyType) ?? [];
  return `${functionName}(${formattedInputs.join(",")})`;
};

const CREATE_STREAM_SIGNATURE =
  "createStream(address,uint256,address,uint256,uint256,uint8,address)";

const decodeCalldataWithSignature = ({ signature, calldata }) => {
  try {
    const { name, inputs: inputTypes } = parseAbiItem(`function ${signature}`);
    if (inputTypes.length === 0) return { name, inputs: [], inputTypes: [] };

    try {
      const inputs = decodeAbiParameters(inputTypes, calldata);
      return { name, inputs, inputTypes };
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

export const parse = (data) => {
  const nounsGovernanceContract = resolveIdentifier("dao");
  const nounsPayerContract = resolveIdentifier("payer");
  const nounsTokenBuyerContract = resolveIdentifier("token-buyer");
  const nounsExecutorContract = resolveIdentifier("executor");
  const nounsTokenContract = resolveIdentifier("token");
  const wethTokenContract = resolveIdentifier("weth-token");
  const stethTokenContract = resolveIdentifier("steth-token");
  const usdcTokenContract = resolveIdentifier("usdc-token");

  const transactions = data.targets.map((target, i) => ({
    target: target.toLowerCase(),
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
      return inputs[6].toLowerCase();
    });

  return transactions.map(({ target, signature, calldata, value }) => {
    const isEthTransfer = signature == null && calldata === "0x";

    if (isEthTransfer)
      return target === nounsTokenBuyerContract.address
        ? { type: "payer-top-up", target, value }
        : { type: "transfer", target, value };

    if (signature == null)
      return value > 0
        ? { type: "unparsed-payable-function-call", target, calldata, value }
        : { type: "unparsed-function-call", target, calldata };

    const {
      name: functionName,
      inputs: functionInputs,
      inputTypes: functionInputTypes,
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
      const tokenContractAddress = functionInputs[2].toLowerCase();
      const tokenContract = resolveAddress(tokenContractAddress);
      return {
        type: "stream",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        receiverAddress: functionInputs[0].toLowerCase(),
        token: tokenContract?.token,
        tokenAmount: functionInputs[1],
        tokenContractAddress,
        startDate: new Date(Number(functionInputs[3]) * 1000),
        endDate: new Date(Number(functionInputs[4]) * 1000),
        streamContractAddress: functionInputs[6].toLowerCase(),
      };
    }

    if (target === wethTokenContract.address && functionName === "deposit") {
      return {
        type: "weth-deposit",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        value,
      };
    }

    if (target === wethTokenContract.address && functionName === "approve") {
      return {
        type: "weth-approval",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        receiverAddress: functionInputs[0],
        wethAmount: BigInt(functionInputs[1]),
      };
    }

    if (
      target === wethTokenContract.address &&
      signature === "transfer(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress,
      );

      return {
        type: isStreamFunding ? "weth-stream-funding" : "weth-transfer",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        receiverAddress: functionInputs[0],
        wethAmount: BigInt(functionInputs[1]),
      };
    }

    if (
      target === stethTokenContract.address &&
      signature === "transfer(address,uint256)"
    ) {
      return {
        type: "steth-transfer",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        receiverAddress: functionInputs[0],
        stethAmount: BigInt(functionInputs[1]),
      };
    }

    if (
      target === usdcTokenContract.address &&
      signature === "approve(address,uint256)"
    ) {
      return {
        type: "usdc-approval",
        spenderAddress: functionInputs[0],
        usdcAmount: BigInt(functionInputs[1]),
        target,
        functionName,
        functionInputs,
        functionInputTypes,
      };
    }

    if (
      target === nounsPayerContract.address &&
      signature === "sendOrRegisterDebt(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress,
      );

      return {
        type: isStreamFunding
          ? "usdc-stream-funding-via-payer"
          : "usdc-transfer-via-payer",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        receiverAddress: functionInputs[0],
        usdcAmount: BigInt(functionInputs[1]),
      };
    }

    if (
      target === nounsTokenContract.address &&
      (signature === "transferFrom(address,address,uint256)" ||
        signature === "safeTransferFrom(address,address,uint256)") &&
      functionInputs[0].toLowerCase() ===
        nounsExecutorContract.address.toLowerCase()
    )
      return {
        type: "treasury-noun-transfer",
        nounId: parseInt(functionInputs[2]),
        receiverAddress: functionInputs[1],
        safe: signature === "safeTransferFrom(address,address,uint256)",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
      };

    if (
      target === nounsGovernanceContract.address &&
      signature ===
        "withdrawDAONounsFromEscrowIncreasingTotalSupply(uint256[],address)"
    ) {
      return {
        type: "escrow-noun-transfer",
        nounIds: functionInputs[0].map((id) => parseInt(id)),
        receiverAddress: functionInputs[1],
        target,
        functionName,
        functionInputs,
        functionInputTypes,
      };
    }

    if (value > 0)
      return {
        type: "payable-function-call",
        target,
        functionName,
        functionInputs,
        functionInputTypes,
        value,
      };

    return {
      type: "function-call",
      target,
      functionName,
      functionInputs,
      functionInputTypes,
    };
  });
};

export const unparse = (transactions) => {
  const nounsGovernanceContract = resolveIdentifier("dao");
  const nounsExecutorContract = resolveIdentifier("executor");
  const nounsTokenContract = resolveIdentifier("token");
  const wethTokenContract = resolveIdentifier("weth-token");
  const stethTokenContract = resolveIdentifier("steth-token");
  const nounsPayerContract = resolveIdentifier("payer");
  const nounsTokenBuyerContract = resolveIdentifier("token-buyer");
  const nounsStreamFactoryContract = resolveIdentifier("stream-factory");

  return transactions.reduce(
    (acc, t) => {
      const append = (t) => ({
        targets: [...acc.targets, t.target],
        values: [...acc.values, t.value?.toString()],
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

        case "payer-top-up":
          return append({
            target: nounsTokenBuyerContract.address,
            value: t.value.toString(),
            signature: "",
            calldata: "0x",
          });

        case "usdc-transfer-via-payer":
        case "usdc-stream-funding-via-payer":
          return append({
            target: nounsPayerContract.address,
            value: "0",
            signature: "sendOrRegisterDebt(address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }],
              [t.receiverAddress, t.usdcAmount],
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
              [t.receiverAddress, t.wethAmount],
            ),
          });

        case "steth-transfer":
          return append({
            target: stethTokenContract.address,
            value: "0",
            signature: "transfer(address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }],
              [t.receiverAddress, t.stethAmount],
            ),
          });

        case "stream": {
          const tokenContract = resolveIdentifier(
            `${t.token.toLowerCase()}-token`,
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
              ],
            ),
          });
        }

        case "treasury-noun-transfer":
          return append({
            target: nounsTokenContract.address,
            value: "0",
            signature: !t.safe
              ? "transferFrom(address,address,uint256)"
              : "safeTransferFrom(address,address,uint256)",
            calldata: encodeAbiParameters(
              [{ type: "address" }, { type: "address" }, { type: "uint256" }],
              [nounsExecutorContract.address, t.receiverAddress, t.nounId],
            ),
          });

        case "escrow-noun-transfer":
          return append({
            target: nounsGovernanceContract.address,
            value: "0",
            signature:
              "withdrawDAONounsFromEscrowIncreasingTotalSupply(uint256[],address)",
            calldata: encodeAbiParameters(
              [{ type: "uint256[]" }, { type: "address" }],
              [t.nounIds, t.receiverAddress],
            ),
          });

        // Fallback strategy
        case "usdc-approval": {
          if (
            t.target == null ||
            t.functionName == null ||
            !Array.isArray(t.functionInputTypes) ||
            !Array.isArray(t.functionInputs)
          )
            throw new Error(`Unknown transaction type "${t.type}"`);

          const signature = createSignature({
            functionName: t.functionName,
            inputTypes: t.functionInputTypes,
          });
          return append({
            target: t.target,
            value: t.value ?? "0",
            signature,
            calldata: encodeAbiParameters(
              t.functionInputTypes,
              t.functionInputs,
            ),
          });
        }

        case "function-call":
        case "payable-function-call":
        case "weth-approval": {
          const signature = createSignature({
            functionName: t.functionName,
            inputTypes: t.functionInputTypes,
          });
          return append({
            target: t.target,
            value: t.type === "payable-function-call" ? t.value : "0",
            signature,
            calldata: encodeAbiParameters(
              t.functionInputTypes,
              t.functionInputs,
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

        default:
          throw new Error(`Unknown transaction type "${t.type}"`);
      }
    },
    { targets: [], values: [], signatures: [], calldatas: [] },
  );
};

export const extractAmounts = (parsedTransactions) => {
  const ethTransfersAndPayableCalls = parsedTransactions.filter(
    (t) =>
      // Exclude Payer top-ups
      t.type !== "payer-top-up" &&
      // Exclude WETH deposits as these are handled separately
      t.type !== "weth-deposit" &&
      t.value != null,
  );
  const wethTransfers = parsedTransactions.filter(
    (t) =>
      t.type === "weth-transfer" ||
      t.type === "weth-approval" ||
      t.type === "weth-stream-funding",
  );

  const stEthTransfers = parsedTransactions.filter(
    (t) => t.type === "steth-transfer",
  );

  const usdcTransfers = parsedTransactions.filter(
    (t) =>
      t.type === "usdc-approval" ||
      t.type === "usdc-transfer-via-payer" ||
      t.type === "usdc-stream-funding-via-payer",
  );

  const treasuryNounTransferNounIds = parsedTransactions
    .filter((t) => t.type === "treasury-noun-transfer")
    .map((t) => t.nounId);
  const escrowNounTransferNounIds = parsedTransactions
    .filter((t) => t.type === "escrow-noun-transfer")
    .flatMap((t) => t.nounIds);

  const ethAmount = ethTransfersAndPayableCalls.reduce(
    (sum, t) => sum + t.value,
    BigInt(0),
  );
  const wethAmount = wethTransfers.reduce(
    (sum, t) => sum + t.wethAmount,
    BigInt(0),
  );
  const stEthAmount = stEthTransfers.reduce(
    (sum, t) => sum + t.stethAmount,
    BigInt(0),
  );

  const usdcAmount = usdcTransfers.reduce(
    (sum, t) => sum + t.usdcAmount,
    BigInt(0),
  );

  return [
    { currency: "eth", amount: ethAmount },
    { currency: "weth", amount: wethAmount },
    { currency: "steth", amount: stEthAmount },
    { currency: "usdc", amount: usdcAmount },
    {
      currency: "nouns",
      tokens: [...treasuryNounTransferNounIds, ...escrowNounTransferNounIds],
    },
  ].filter((e) => e.amount > 0 || e.tokens?.length > 0);
};

export const buildActions = (transactions) => {
  const getTransactionIndex = (t) => transactions.findIndex((t_) => t_ === t);

  let transactionsLeft = [...transactions];
  const actions = [];

  const extractStreamAction = () => {
    const streamTx = transactionsLeft.find((t) => t.type === "stream");

    if (streamTx == null) return null;

    const usdcFundingTx = transactionsLeft.find(
      (t) =>
        t.type === "usdc-stream-funding-via-payer" &&
        t.receiverAddress.toLowerCase() ===
          streamTx.streamContractAddress.toLowerCase(),
    );

    if (usdcFundingTx != null) {
      transactionsLeft = transactionsLeft.filter(
        (t) => t !== streamTx && t !== usdcFundingTx,
      );

      return {
        type: "streaming-payment",
        target: streamTx.receiverAddress,
        currency: "usdc",
        amount: formatUnits(streamTx.tokenAmount, decimalsByCurrency["usdc"]),
        startTimestamp: streamTx.startDate.getTime(),
        endTimestamp: streamTx.endDate.getTime(),
        predictedStreamContractAddress: streamTx.streamContractAddress,
        firstTransactionIndex: Math.min(
          ...[streamTx, usdcFundingTx].map(getTransactionIndex),
        ),
      };
    }

    const wethFundingTx = transactionsLeft.find(
      (t) =>
        t.type === "weth-stream-funding" &&
        t.receiverAddress.toLowerCase() ===
          streamTx.streamContractAddress.toLowerCase(),
    );

    if (wethFundingTx == null) return null;

    const wethDepositTx = transactionsLeft.find(
      (t) =>
        t.type === "weth-deposit" &&
        t.value.toString() === wethFundingTx.wethAmount.toString(),
    );

    if (wethDepositTx == null) return null;

    transactionsLeft = transactionsLeft.filter(
      (t) => t !== streamTx && t !== wethFundingTx && t !== wethDepositTx,
    );

    return {
      type: "streaming-payment",
      target: streamTx.receiverAddress,
      currency: "weth",
      amount: formatUnits(streamTx.tokenAmount, decimalsByCurrency["weth"]),
      startTimestamp: streamTx.startDate.getTime(),
      endTimestamp: streamTx.endDate.getTime(),
      predictedStreamContractAddress: streamTx.streamContractAddress,
      firstTransactionIndex: Math.min(
        ...[streamTx, wethFundingTx, wethDepositTx].map(getTransactionIndex),
      ),
    };
  };

  const extractOneTimePaymentAction = () => {
    const transferTx = transactionsLeft.find((t) => t.type === "transfer");

    if (transferTx != null) {
      transactionsLeft = transactionsLeft.filter((t) => t !== transferTx);
      return {
        type: "one-time-payment",
        target: transferTx.target,
        currency: "eth",
        amount: formatEther(transferTx.value),
        firstTransactionIndex: getTransactionIndex(transferTx),
      };
    }

    const usdcTransferTx = transactionsLeft.find(
      (t) => t.type === "usdc-transfer-via-payer",
    );

    if (usdcTransferTx != null) {
      transactionsLeft = transactionsLeft.filter((t) => t !== usdcTransferTx);
      return {
        type: "one-time-payment",
        target: usdcTransferTx.receiverAddress,
        currency: "usdc",
        amount: formatUnits(
          usdcTransferTx.usdcAmount,
          decimalsByCurrency["usdc"],
        ),
        firstTransactionIndex: getTransactionIndex(usdcTransferTx),
      };
    }

    return null;
  };

  const extractPayerTopUpAction = () => {
    const topUpTx = transactionsLeft.find((t) => t.type === "payer-top-up");

    if (topUpTx == null) return null;

    transactionsLeft = transactionsLeft.filter((t) => t !== topUpTx);

    return {
      type: "payer-top-up",
      amount: formatEther(topUpTx.value),
      firstTransactionIndex: getTransactionIndex(topUpTx),
    };
  };

  const extractCustomTransactionAction = () => {
    if (transactionsLeft.length === 0) return null;

    const tx = transactionsLeft[0];

    const { targets, signatures, calldatas, values } = unparse([tx]);

    transactionsLeft = transactionsLeft.slice(1);

    const { name, inputs, inputTypes } = decodeCalldataWithSignature({
      signature: signatures[0],
      calldata: calldatas[0],
    });
    const signature = createSignature({
      functionName: name,
      inputTypes: inputTypes,
    });

    return {
      type: "custom-transaction",
      contractCallTarget: targets[0],
      contractCallSignature: signature,
      contractCallArguments: inputs,
      contractCallValue: values[0],
      firstTransactionIndex: getTransactionIndex(tx),
    };
  };

  while (transactionsLeft.length > 0) {
    const streamAction = extractStreamAction();
    if (streamAction != null) {
      actions.push(streamAction);
      continue;
    }

    const oneTimePaymentAction = extractOneTimePaymentAction();
    if (oneTimePaymentAction != null) {
      actions.push(oneTimePaymentAction);
      continue;
    }

    const payerTopUpAction = extractPayerTopUpAction();
    if (payerTopUpAction != null) {
      actions.push(payerTopUpAction);
      continue;
    }

    const customTransactionAction = extractCustomTransactionAction();
    if (customTransactionAction != null) {
      actions.push(customTransactionAction);
      continue;
    }

    throw new Error();
  }

  return arrayUtils.sortBy("firstTransactionIndex", actions);
};

export const resolveAction = (a) => {
  const nounsTokenBuyerContract = resolveIdentifier("token-buyer");

  const getParsedTransactions = () => {
    switch (a.type) {
      case "one-time-payment": {
        switch (a.currency) {
          case "eth":
            return [
              {
                type: "transfer",
                target: a.target,
                value: parseEther(a.amount),
              },
            ];

          case "usdc":
            return [
              {
                type: "usdc-transfer-via-payer",
                receiverAddress: a.target,
                usdcAmount: parseUnits(a.amount, 6),
              },
            ];

          default:
            throw new Error();
        }
      }

      case "streaming-payment": {
        const createStreamTransaction = {
          type: "stream",
          receiverAddress: a.target,
          token: a.currency.toUpperCase(),
          tokenAmount: parseUnits(a.amount, decimalsByCurrency[a.currency]),
          startDate: new Date(a.startTimestamp),
          endDate: new Date(a.endTimestamp),
          streamContractAddress: a.predictedStreamContractAddress,
        };

        switch (a.currency) {
          case "weth":
            return [
              createStreamTransaction,
              {
                type: "weth-deposit",
                value: parseUnits(a.amount, decimalsByCurrency.eth),
              },
              {
                type: "weth-stream-funding",
                receiverAddress: a.predictedStreamContractAddress,
                wethAmount: parseUnits(a.amount, decimalsByCurrency.weth),
              },
            ];

          case "usdc":
            return [
              createStreamTransaction,
              {
                type: "usdc-stream-funding-via-payer",
                receiverAddress: a.predictedStreamContractAddress,
                usdcAmount: parseUnits(a.amount, decimalsByCurrency.usdc),
              },
            ];

          default:
            throw new Error();
        }
      }

      case "treasury-noun-transfer":
        return [
          {
            type: "treasury-noun-transfer",
            nounId: a.nounId,
            receiverAddress: a.target,
            safe: true,
          },
        ];

      case "payer-top-up":
        return [
          {
            type: "payer-top-up",
            target: nounsTokenBuyerContract,
            value: parseEther(a.amount),
          },
        ];

      case "custom-transaction": {
        const { name: functionName, inputs: functionInputTypes } = parseAbiItem(
          `function ${a.contractCallSignature}`,
        );

        if (a.contractCallValue > 0)
          return [
            {
              type: "payable-function-call",
              target: a.contractCallTarget,
              functionName,
              functionInputs: a.contractCallArguments,
              functionInputTypes,
              value: a.contractCallValue,
            },
          ];

        return [
          {
            type: "function-call",
            target: a.contractCallTarget,
            functionName,
            functionInputs: a.contractCallArguments,
            functionInputTypes,
          },
        ];
      }

      default:
        throw new Error();
    }
  };

  return parse(unparse(getParsedTransactions()));
};

export const stringify = (parsedTransaction) => {
  const { targets, values, signatures, calldatas } = unparse([
    parsedTransaction,
  ]);

  if (signatures[0] == null || signatures[0] === "") {
    return [
      targets[0] == null ? null : `target: ${targets[0]}`,
      (calldatas[0] ?? "0x") === "0x" ? null : `calldata: ${calldatas[0]}`,
      (values[0] ?? "0") === "0" ? null : `value: ${values[0]}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const { name: functionName, inputs: inputTypes } = parseAbiItem(
    `function ${signatures[0]}`,
  );
  const inputs = decodeAbiParameters(inputTypes, calldatas[0]);

  const truncatedTarget = `${targets[0].slice(0, 6)}...${targets[0].slice(-4)}`;

  const formattedFunctionCall =
    inputs.length === 0
      ? `${truncatedTarget}.${functionName}()`
      : `${truncatedTarget}.${functionName}(\n  ${inputs
          .map(ethereumUtils.formatSolidityArgument)
          .join(",\n  ")}\n)`;

  if (values[0] == null || values[0] === "0") return formattedFunctionCall;

  return formattedFunctionCall + `\n value: ${values[0]}`;
};

export const isEqual = (ts1, ts2) => {
  if (ts1.targets.length !== ts2.targets.length) return false;

  return ts1.targets.every((target1, i) => {
    const [signature1, calldata1, value1] = [
      ts1.signatures[i],
      ts1.calldatas[i],
      ts1.values[i],
    ];
    const [target2, signature2, calldata2, value2] = [
      ts2.targets[i],
      ts2.signatures[i],
      ts2.calldatas[i],
      ts2.values[i],
    ];

    return (
      target1 === target2 &&
      signature1 === signature2 &&
      calldata1 === calldata2 &&
      value1 === value2
    );
  });
};

export const isTransactionHash = (s) => isHex(s) && /^0x[0-9a-f]{64}$/i.test(s);
