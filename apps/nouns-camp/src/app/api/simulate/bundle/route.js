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
  });

  // when a simulation fails, the other sims won't be executed
  const data = await response.json();

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

  const simulations = data?.simulation_results?.map((sr) => sr?.simulation);
  await shareSimulations(simulations);

  return new Response(JSON.stringify(simulations), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
