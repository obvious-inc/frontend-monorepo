import { resolveIdentifier } from "../../../contracts";
import { CHAIN_ID } from "./constants/env.js";

const API_ENDPOINT = `https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT_SLUG}`;

const EXPECTED_FAILURE_SLUGS = ["invalid_transaction_simulation"];

const shareSimulation = async (simulation) => {
  if (simulation.status) return;

  fetch(`${API_ENDPOINT}/simulations/${simulation.id}/share`, {
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
  // fetch chain id from request params
  const body = await request.json();

  const { address: executorAddress } = resolveIdentifier("executor");

  const DEFAULT_SIMULATION_PARAMS = {
    gas: 0,
    gas_price: "0",
    network_id: CHAIN_ID,

    // tenderly options
    save: false,
    save_if_fails: true,
    simulation_type: "full",
  };

  const transactions = body.transactions.map((tx) => {
    return {
      ...tx,
      from: executorAddress,

      ...DEFAULT_SIMULATION_PARAMS,
    };
  });

  const singleTransaction = transactions[0];
  const response = await fetch(`${API_ENDPOINT}/simulate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Access-Key": process.env.TENDERLY_API_KEY,
    },
    body: JSON.stringify(singleTransaction),
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

    if (EXPECTED_FAILURE_SLUGS.includes(errorSlug)) {
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

  // run this async to share the simulation
  if (simulation) shareSimulation(simulation);

  return new Response(JSON.stringify({ ...simulation }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
