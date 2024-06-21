import React from "react";
import { decodeAbiParameters, encodeFunctionData, parseAbiItem } from "viem";
import { resolveAction, unparse } from "../utils/transactions";

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

const fetchSimulation = async ({ target, value, signature, calldata }) => {
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

const fetchSimulationBundle = async ({
  targets,
  values,
  signatures,
  calldatas,
}) => {
  var unparsedTxs = targets.map(function (e, i) {
    return {
      target: e,
      value: values[i],
      signature: signatures[i],
      calldata: calldatas[i],
    };
  });
  const parsedTxs = unparsedTxs.map((tx) => parse(tx));
  const body = JSON.stringify(parsedTxs);
  const res = await fetch("/api/simulate-bundle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    throw new Error("Failed to simulate transaction");
  }

  const simulations = await res.json();
  return simulations;
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

export const useBundleActionsSimulation = (actions) => {
  const [isFetching, setIsFetching] = React.useState(false);
  const [actionSimulations, setActionSimulations] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsFetching(true);

      const transactions = actions.map((action) => resolveAction(action));

      setActionSimulations(
        actions.map((_, i) => transactions[i].map(() => ({ fetching: true }))),
      );

      const flatTxs = transactions.flat();
      const txs = unparse(flatTxs);
      const sims = await fetchSimulationBundle(txs);

      // if sims is not an array, then something went wrong
      if (!Array.isArray(sims)) {
        const reason =
          "One or more transactions failed to simulate due to insufficient balance.";

        const errorSim = {
          success: false,
          error: reason,
        };

        // set all sims to the error sim
        setActionSimulations(
          actions.map((_, i) => transactions[i].map(() => errorSim)),
        );
        return;
      }

      const returnSims = sims?.map((s) => {
        return {
          success: s?.status,
          error: s?.error_message,
          id: s?.id,
        };
      });

      let lastSlicePos = 0;
      const finalSims = actions.map((_, i) => {
        const sliceStart = lastSlicePos;
        lastSlicePos += transactions[i].length;
        return returnSims.slice(sliceStart, lastSlicePos);
      });

      setActionSimulations(finalSims);
    } catch (e) {
      console.error(e);
      setActionSimulations(null);
    } finally {
      setIsFetching(false);
    }
  }, [actions]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    results: actionSimulations?.map((a) => {
      return a.map((s) => {
        return {
          fetching: isFetching,
          ...s,
        };
      });
    }),
  };
};
