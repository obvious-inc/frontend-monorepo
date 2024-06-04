import { resolveIdentifier } from "../../../contracts";

const API_ENDPOINT = `https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT_SLUG}`;

const shareSimulation = async (simulation) => {
  // share only if failure
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
  const body = await request.json();

  const { address: executorAddress } = resolveIdentifier("executor");

  const DEFAULT_SIMULATION_PARAMS = {
    network_id: "1", // use chain id
    save: false, // disable this when going live
    save_if_fails: true, // same as above
    simulation_type: "full", //
  };

  const transactions = body.transactions.map((tx) => {
    return {
      ...tx,
      from: executorAddress,
      gas: 0,
      gas_price: "0",
      ...DEFAULT_SIMULATION_PARAMS,
    };
  });

  const singleTransaction = transactions[0];

  const response = await fetch(`${API_ENDPOINT}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
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
