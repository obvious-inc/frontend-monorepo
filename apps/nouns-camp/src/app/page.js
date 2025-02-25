import { parsedSubgraphFetch } from "../nouns-subgraph.js";
import ClientAppProvider from "./client-app-provider.js";
import LandingScreen from "../components/landing-screen.js";
import { Hydrater } from "../store.js";

async function fetchInitialData() {
  const { proposals, proposalCandidates } = await parsedSubgraphFetch({
    query: `{
      proposals(
        orderBy: createdBlock,
        orderDirection: desc,
        first: 10
      ) {
        id
        title
        status
        createdBlock
        createdTimestamp
        createdTransactionHash
        lastUpdatedBlock
        lastUpdatedTimestamp
        startBlock
        endBlock
        updatePeriodEndBlock
        objectionPeriodEndBlock
        canceledBlock
        canceledTimestamp
        canceledTransactionHash
        queuedBlock
        queuedTimestamp
        queuedTransactionHash
        executedBlock
        executedTimestamp
        executedTransactionHash
        forVotes
        againstVotes
        abstainVotes
        quorumVotes
        executionETA
        proposer { id }
        signers { id }
        targets
        values
        signatures
        calldatas
      }
      proposalCandidates(
        orderBy: createdBlock,
        orderDirection: desc,
        first: 10
      ) {
        id
        slug
        proposer { id }
        createdBlock
        createdTimestamp
        lastUpdatedBlock
        lastUpdatedTimestamp
        canceledBlock
        canceledTimestamp
        latestVersion {
          id
          createdBlock
          createdTimestamp
          updateMessage
          content {
            title
            description
            contentSignatures {
              createdBlock
              createdTimestamp
              signer { id }
            }
          }
        }
      }
    }`,
  });

  return {
    proposalsById: proposals.reduce((acc, proposal) => {
      acc[proposal.id] = proposal;
      return acc;
    }, {}),
    proposalCandidatesById: proposalCandidates.reduce((acc, candidate) => {
      acc[candidate.id] = candidate;
      return acc;
    }, {}),
  };
}

export default async function Page() {
  const initialData = await fetchInitialData();

  return (
    <ClientAppProvider>
      <Hydrater state={initialData} />
      <LandingScreen />
    </ClientAppProvider>
  );
}
