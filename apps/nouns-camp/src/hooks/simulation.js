import React from "react";
import { useFetch } from "@shades/common/react";
import { encodeFunctionData, parseAbi } from "viem";

export const fetchSimulation = async (action, transaction) => {
  // TODO: should this be part of the transaction?
  const encodedData = encodeFunctionData({
    abi: parseAbi([`function ${action.contractCallSignature}`]),
    name: action.contractCallSignature.split("(")[0],
    args: action.contractCallArguments,
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

export const useTransactionSimulation = (action, transaction) => {
  const [isFetching, setIsFetching] = React.useState(false);
  const [simulation, setSimulation] = React.useState(null);

  const fetchData = React.useCallback(
    async ({ signal }) => {
      try {
        setIsFetching(true);
        const sim = await fetchSimulation(action, transaction);
        if (signal?.aborted) return;
        setSimulation(sim);
      } finally {
        setIsFetching(false);
      }
    },
    [action, transaction],
  );

  useFetch(fetchData, [fetchData]);

  if (action.type !== "custom-transaction") {
    // TODO: parse non-custom transactions too
    throw new Error("Can only simulate custom transactions");
  }

  return {
    fetching: isFetching,
    result: simulation?.result,
    error: simulation?.error_message,
    raw: simulation,
  };
};
