import React from "react";
import { decodeAbiParameters, encodeFunctionData, parseAbiItem } from "viem";
import { unparse } from "../utils/transactions";

const SIMULATE_TRANSACTION_TYPES = [
  "function-call",
  "proxied-function-call",
  "payable-function-call",
  "proxied-payable-function-call",
  "treasury-noun-transfer",
  "escrow-noun-transfer",
  "transfer",
  "usdc-transfer-via-payer",
];

const parse = ({ target, value, signature, calldata }) => {
  if (signature === "") {
    return {
      to: target,
      input: calldata,
      value,
    };
  }

  const { name, inputs } = parseAbiItem(`function ${signature}`);
  const args = decodeAbiParameters(inputs, calldata);

  const encodedData = encodeFunctionData({
    abi: [
      {
        inputs: inputs,
        name: name,
        type: "function",
      },
    ],
    functionName: name,
    args: args,
  });

  return {
    to: target,
    value: value || "0",
    input: encodedData,
  };
};

export const fetchSimulation = async ({
  target,
  value,
  signature,
  calldata,
}) => {
  console.log({ target, value, signature, calldata });
  const parsedTx = parse({ target, value, signature, calldata });
  const body = JSON.stringify(parsedTx);
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    throw new Error("Failed to simulate transaction");
  }

  const simulation = await res.json();
  return simulation;
};

export const useTransactionSimulation = (transaction) => {
  const [isFetching, setIsFetching] = React.useState(false);
  const [simulation, setSimulation] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsFetching(true);
      if (!SIMULATE_TRANSACTION_TYPES.includes(transaction.type)) {
        setSimulation(null);
        return;
      }

      const { targets, values, signatures, calldatas } = unparse([transaction]);

      const tx = {
        target: targets[0],
        value: values[0],
        signature: signatures[0],
        calldata: calldatas[0],
      };

      const sim = await fetchSimulation(tx);
      setSimulation(sim);
    } catch (e) {
      console.error(e);
      setSimulation(null);
    } finally {
      setIsFetching(false);
    }
  }, [transaction]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    fetching: isFetching,
    success: simulation?.status,
    error: simulation?.error_message,
    id: simulation?.id,
  };
};
