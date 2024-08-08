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

export const useActionBundleSimulation = (actions, { enabled = true } = {}) => {
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [isFetching, setIsFetching] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);

      const transactions = actions.map((action) => resolveAction(action));

      const flatTxs = transactions.flat();
      const txs = unparse(flatTxs);
      const sims = await fetchSimulationBundle(txs);

      // if sims is not an array, then something went wrong
      if (!Array.isArray(sims)) {
        const reason =
          "One or more transactions failed to simulate due to insufficient balance.";

        const errorSim = {
          success: false,
          error: transactions.length > 1 ? reason : sims.error_message,
        };

        setError(reason);

        // set all sims to the error sim
        setData(actions.map((_, i) => transactions[i].map(() => errorSim)));
        return;
      }

      if (sims.some((s) => !s.status)) {
        // todo: handle other possible errors
        setError("One or more transactions failed to simulate.");
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

      setData(finalSims);
    } catch (e) {
      setData(null);
    } finally {
      setIsFetching(false);
    }
  }, [actions]);

  React.useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [fetchData, enabled]);

  if (!enabled) return { data: null, error: null, isFetching: false };
  return { data, error, isFetching };
};

export const useProposalSimulation = (
  proposalId,
  { version, enabled } = {},
) => {
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [isFetching, setIsFetching] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);

      const res = await fetch(
        `/api/simulate/proposal/${proposalId}?version=${version}`,
      );
      const data = await res.json();
      const simulations = data?.simulations;

      setData(
        simulations?.map((s) => {
          return {
            success: s?.status,
            error: s?.error_message,
            id: s?.id,
          };
        }),
      );

      if (simulations.some((s) => !s.status)) {
        // todo: handle other possible errors
        setError("One or more transactions failed to simulate.");
      }
    } catch (e) {
      setData(null);
    } finally {
      setIsFetching(false);
    }
  }, [proposalId, version]);

  React.useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [fetchData, enabled]);

  if (!enabled) return { data: null, error: null, isFetching: false };
  return { data, error, isFetching };
};

export const useProposalCandidateSimulation = (
  candidateId,
  { version, enabled } = {},
) => {
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [isFetching, setIsFetching] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);

      const res = await fetch(
        `/api/simulate/candidate/${encodeURIComponent(candidateId)}?version=${version}`,
      );
      const data = await res.json();
      const simulations = data?.simulations;

      setData(
        simulations?.map((s) => {
          return {
            success: s?.status,
            error: s?.error_message,
            id: s?.id,
          };
        }),
      );

      if (simulations.some((s) => !s.status)) {
        // todo: handle other possible errors
        setError("One or more transactions failed to simulate.");
      }
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setIsFetching(false);
    }
  }, [candidateId, version]);

  React.useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [fetchData, enabled]);

  if (!enabled) return { data: null, error: null, isFetching: false };
  return { data, error, isFetching };
};
