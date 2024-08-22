import { decodeAbiParameters, encodeFunctionData, parseAbiItem } from "viem";
import { reportError } from "../../utils/monitoring.js";
import { resolveIdentifier } from "../../contracts.js";
import { CHAIN_ID } from "../../constants/env.js";

export const TENDERLY_API_ENDPOINT = `https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT_SLUG}`;
export const TENDERLY_SIMULATION_OPTIONS = {
  save: true,
  save_if_fails: true,
  simulation_type: "full",
};

const shareSimulation = async (simulation) => {
  try {
    const response = await fetch(
      `${TENDERLY_API_ENDPOINT}/simulations/${simulation.id}/share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Access-Key": process.env.TENDERLY_API_KEY,
        },
      },
    );

    if (!response.ok) {
      reportError(
        new Error(
          `Failed to share simulation, API returned ${response.status}`,
        ),
      );
    }
  } catch (error) {
    reportError(error);
  }
};

export const shareSimulations = async (simulations) => {
  if (!simulations) return;

  for (const simulation of simulations) {
    await shareSimulation(simulation);
  }
};

export const parseProposalAction = ({ target, value, signature, calldata }) => {
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

export const fetchSimulationBundle = async (unparsedTxs) => {
  const { address: executorAddress } = resolveIdentifier("executor");

  const parsedTxs = unparsedTxs.map((t) => parseProposalAction(t));
  const parsedTransactions = parsedTxs.map((transaction) => {
    return {
      ...transaction,
      from: executorAddress,
      estimate_gas: true,
      network_id: CHAIN_ID,
      ...TENDERLY_SIMULATION_OPTIONS,
    };
  });

  const response = await fetch(`${TENDERLY_API_ENDPOINT}/simulate-bundle`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Access-Key": process.env.TENDERLY_API_KEY,
    },
    body: JSON.stringify({ simulations: parsedTransactions }),
  });

  const data = await response.json();

  const propCacheHeader = "max-age=3600";

  if (!response.ok) {
    const errorSlug = data?.error?.slug;

    // not enough balance comes up as 400 error
    if (errorSlug == "invalid_transaction_simulation") {
      // return an array with same length as the number of transactions
      const errorResults = Array(parsedTransactions.length).fill({
        status: false,
        error_message: data?.error?.message,
      });

      return new Response(
        JSON.stringify({
          simulations: errorResults,
          status: false,
          error_message: data?.error?.message,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": propCacheHeader,
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "simulation-error",
        reason: data?.error?.message,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const simulations =
    data?.simulation_results?.map((sr) => {
      const simulation = sr.simulation || {};
      return {
        id: simulation.id,
        status: simulation.status,
        error_message: simulation.error_message,
      };
    }) ?? [];

  if (simulations.length == 0) {
    return new Response(
      JSON.stringify({
        error: "empty-simulation",
        reason: "No simulation results",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  // sometimes tenderly will return an internal server error
  // we should consider that a tenderly api error and return a 400 error
  if (
    simulations.some(
      (s) => s.error_message?.toLowerCase() === "internal server error",
    )
  ) {
    return new Response(
      JSON.stringify({
        error: "tenderly-api-error",
        reason: "Internal Server Error",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  await shareSimulations(simulations);

  return new Response(JSON.stringify({ simulations: simulations }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": propCacheHeader,
    },
  });
};
