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
  if (!SIMULATE_TRANSACTION_TYPES.includes(transaction.type)) {
    return null;
  }

  const transactionValue = (transaction) => {
    switch (transaction.type) {
      case "payable-function-call":
      case "proxied-payable-function-call":
        return transaction.value;
      default:
        return 0;
    }
  };

  const encodedData = (transaction) => {
    if (!transaction.functionName) {
      return "";
    }

    return encodeFunctionData({
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
  };

  const parsedTransaction = {
    to: transaction.target,
    value: transactionValue(transaction).toString(),
    input: encodedData(transaction),
  };

  const body = JSON.stringify(parsedTransaction);
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

  return {
    fetching: isFetching,
    success: simulation?.status,
    error: simulation?.error_message,
    id: simulation?.id,
  };
};
