import { reportError } from "../../utils/monitoring.js";

export const TENDERLY_API_ENDPOINT = `https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT_SLUG}`;
export const TENDERLY_SIMULATION_OPTIONS = {
  save: true,
  save_if_fails: true,
  simulation_type: "full",
};

export const shareSimulation = async (simulation) => {
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
  for (const simulation of simulations) {
    await shareSimulation(simulation);
  }
};
