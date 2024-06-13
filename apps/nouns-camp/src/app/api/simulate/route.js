import { CHAIN_ID } from "../../../constants/env.js";
import { resolveIdentifier } from "../../../contracts";

const TENDERLY_API_ENDPOINT = `https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT_SLUG}`;
const TENDERLY_SIMULATION_OPTIONS = {
  save: false,
  save_if_fails: true,
  simulation_type: "full",
};

const shareSimulation = async (simulation) => {
  if (simulation.status) return;

  fetch(`${TENDERLY_API_ENDPOINT}/simulations/${simulation.id}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Access-Key": process.env.TENDERLY_API_KEY,
    },
  })
    .then((response) => {
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "simulation-share-error" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
    })
    .catch((error) => {
      console.error("simulation share error", error);
    });
};

export async function POST(request) {
  const body = await request.json();

  const { address: executorAddress } = resolveIdentifier("executor");

  const parsedTransaction = {
    ...body,
    from: executorAddress,
    estimate_gas: true,
    network_id: CHAIN_ID,
    ...TENDERLY_SIMULATION_OPTIONS,
  };

  const response = await fetch(`${TENDERLY_API_ENDPOINT}/simulate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Access-Key": process.env.TENDERLY_API_KEY,
    },
    body: JSON.stringify(parsedTransaction),
  }).catch(() => {
    return new Response(
      JSON.stringify({ error: "simulation-unexpected-error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

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

  const simulation = data.simulation;

  // (async) share simulation
  if (simulation) await shareSimulation(simulation);

  return new Response(JSON.stringify({ ...simulation }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
