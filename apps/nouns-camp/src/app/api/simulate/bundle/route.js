import { CHAIN_ID } from "../../../../constants/env";
import { resolveIdentifier } from "../../../../contracts";
import {
  TENDERLY_API_ENDPOINT,
  TENDERLY_SIMULATION_OPTIONS,
  shareSimulations,
} from "../../tenderly-utils";

export const runtime = "edge";

export async function POST(request) {
  const { address: executorAddress } = resolveIdentifier("executor");

  const body = await request.json();

  const parsedTransactions = body.map((transaction) => {
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
    cache: "no-cache",
  });

  // when a simulation fails, the other sims won't be executed
  const data = await response.json();

  // TODO: unify error handling between bundles and normal prop/candie sim
  if (!response.ok) {
    const errorSlug = data?.error?.slug;

    // not enough balance comes up as 400 error
    if (errorSlug == "invalid_transaction_simulation") {
      return new Response(
        JSON.stringify({ status: false, error_message: data?.error?.message }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
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

  // sometimes tenderly will return an internal server error within the simulation response
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

  return new Response(JSON.stringify(simulations), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
