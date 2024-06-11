import React from "react";
import { encodeFunctionData } from "viem";

const SIMULATE_TRANSACTION_TYPES = [
  "function-call",
  "proxied-function-call",
  "payable-function-call",
  "proxied-payable-function-call",
  "treasury-noun-transfer",
  "escrow-noun-transfer",
];

export const fetchSimulation = async (transaction) => {
  const encodedData = encodeFunctionData({
    abi: [
      {
        inputs: transaction.functionInputTypes,
        name: transaction.functionName,
        type: "function",
      },
    ],
    functionName: transaction.functionName,
    args: transaction.functionInputs,
  });
  const parsedTransaction = {
    to: transaction.target,
    value:
      transaction.type === "payable-function-call"
        ? Number(transaction.value)
        : 0,
    input: encodedData,
  };
  const body = JSON.stringify({ transactions: [parsedTransaction] });
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
      const sim = await fetchSimulation(transaction);
      setSimulation(sim);
    } finally {
      setIsFetching(false);
    }
  }, [transaction]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!SIMULATE_TRANSACTION_TYPES.includes(transaction.type)) {
    console.warn(
      "Transaction type not supported for simulation",
      transaction.type,
    );
  }

  return {
    fetching: isFetching,
    result: simulation?.result,
    error: simulation?.error_message,
    raw: simulation,
  };
};
