import { fetchSimulationBundle } from "../../../tenderly-utils";
import { parseCandidate, subgraphFetch } from "../../../../../nouns-subgraph";

const fetchCandidate = async (id) => {
  const data = await subgraphFetch({
    query: `
      query {
        proposalCandidate(id: "${id}") {
          id
          slug
          proposer
          canceledTimestamp
          latestVersion {
            id
            content {
              targets
              values
              signatures
              calldatas
            }
          }
        }
      }`,
  });

  if (data?.proposalCandidate == null) return null;

  return parseCandidate(data.proposalCandidate);
};

export async function GET(_, context) {
  const candidateId = context.params.id;
  const candidate = await fetchCandidate(candidateId);
  const { targets, values, signatures, calldatas } =
    candidate.latestVersion.content;

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
