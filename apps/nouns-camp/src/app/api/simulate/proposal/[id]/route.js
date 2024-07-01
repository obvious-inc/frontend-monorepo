import { createPublicClient, http } from "viem";
import { getChain } from "../../../../../utils/chains";
import { getJsonRpcUrl } from "../../../../../wagmi-config";
import { CHAIN_ID } from "../../../../../constants/env";
import { resolveIdentifier } from "../../../../../contracts";
import {
  TENDERLY_API_ENDPOINT,
  TENDERLY_SIMULATION_OPTIONS,
  parseProposalAction,
  shareSimulations,
} from "../../../tenderly-utils";

export const runtime = "edge";

const chain = getChain(CHAIN_ID);

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

export async function GET(_, context) {
  const proposalId = context.params.id;
  const { address: daoAddress } = resolveIdentifier("dao");
  const { address: executorAddress } = resolveIdentifier("executor");

  const proposalActions = await publicClient.readContract({
    address: daoAddress,
    abi: [
      {
        inputs: [{ name: "proposalId", type: "uint256" }],
        name: "getActions",
        outputs: [
          { name: "targets", type: "address[]" },
          { name: "values", type: "uint256[]" },
          { name: "signatures", type: "string[]" },
          { name: "calldatas", type: "bytes[]" },
        ],
        type: "function",
      },
    ],
    functionName: "getActions",
    args: [Number(proposalId)],
  });

  const [targets, values, signatures, calldatas] = proposalActions;
  var unparsedTxs = targets.map(function (e, i) {
    return {
      target: e,
      value: values[i].toString(),
      signature: signatures[i],
      calldata: calldatas[i],
    };
  });

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

  const simulations = data?.simulation_results?.map((sr) => sr?.simulation);
  await shareSimulations(simulations);

  return new Response(JSON.stringify({ simulations: simulations }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": propCacheHeader,
    },
  });
}
