import { decodeAbiParameters, encodeFunctionData, parseAbiItem } from "viem";
import { reportError } from "../../utils/monitoring.js";

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
