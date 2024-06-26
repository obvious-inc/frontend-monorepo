import React from "react";
import { resolveAction, unparse } from "../utils/transactions";
import { parseProposalAction } from "../app/api/tenderly-utils";

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
  const parsedTxs = unparsedTxs.map((tx) => parseProposalAction(tx));
  const body = JSON.stringify(parsedTxs);
  const res = await fetch("/api/simulate/bundle", {
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

export const useProposalSimulation = ({
  proposalId,
  version,
  actions,
  enabled,
}) => {
  const [isFetching, setIsFetching] = React.useState(false);
  const [simulationResults, setSimulationResults] = React.useState(null);

  const handleBundleSimulation = async ({ actions }) => {
    const transactions = actions.map((action) => resolveAction(action));
    setSimulationResults(
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
      setSimulationResults(
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

    setSimulationResults(finalSims);
  };

  const fetchData = React.useCallback(async () => {
    try {
      if (!enabled) {
        setSimulationResults(null);
        return;
      }

      setIsFetching(true);

      if (!proposalId) {
        // if there's no proposal id, then we're simulating a draft
        return handleBundleSimulation({ actions });
      }

      setSimulationResults(null);

      if (!version) {
        setSimulationResults(null);
        return;
      }

      const res = await fetch(
        `/api/simulate/proposal/${proposalId}?version=${version}`,
      );
      const sims = await res.json();
      const returnSims = sims.simulations?.map((s) => {
        return {
          success: s?.status,
          error: s?.error_message,
          id: s?.id,
        };
      });

      setSimulationResults(returnSims);
    } catch (e) {
      console.error(e);
      setSimulationResults(null);
    } finally {
      setIsFetching(false);
    }
  }, [proposalId, version, actions, enabled]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    results: simulationResults?.map((s) => {
      return {
        fetching: isFetching,
        ...s,
      };
    }),
  };
};
