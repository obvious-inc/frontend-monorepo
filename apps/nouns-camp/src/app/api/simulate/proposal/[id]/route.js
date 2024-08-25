import { createPublicClient, http } from "viem";
import { getChain } from "../../../../../utils/chains";
import { getJsonRpcUrl } from "../../../../../wagmi-config";
import { CHAIN_ID } from "../../../../../constants/env";
import { resolveIdentifier } from "../../../../../contracts";
import { fetchSimulationBundle } from "../../../tenderly-utils";

export const runtime = "edge";

const chain = getChain(CHAIN_ID);

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id), {
    fetchOptions: {
      cache: "no-cache",
    },
  }),
});

export async function GET(_, context) {
  const proposalId = context.params.id;
  const { address: daoAddress } = resolveIdentifier("dao");

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

  return fetchSimulationBundle(unparsedTxs);
}
