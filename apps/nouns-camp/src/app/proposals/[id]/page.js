import { headers } from "next/headers";
import { notFound as nextNotFound } from "next/navigation";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../../../wagmi-config.js";
import { subgraphFetch, parseProposal } from "../../../nouns-subgraph.js";
import { mainnet } from "../../../chains.js";
import { Hydrater as StoreHydrater } from "../../../store.js";
import ClientAppProvider from "../../client-app-provider.js";
import ProposalScreen from "../../../components/proposal-screen.js";

export const runtime = "edge";

const getChainId = () => {
  const wagmiState = getWagmiStateFromCookie(headers().get("cookie"));
  return wagmiState?.chainId ?? mainnet.id;
};

const fetchProposal = async (id, { chainId }) => {
  const data = await subgraphFetch({
    chainId,
    query: `
      query {
        proposal(id: ${id}) {
          id
          description
          status
          createdBlock
          createdTimestamp
          startBlock
          endBlock
          forVotes
          againstVotes
          abstainVotes
          quorumVotes
          executionETA
          proposer {
            id
          }
        }
      }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal, { chainId });
};

export async function generateMetadata({ params }) {
  const proposal = await fetchProposal(params.id, { chainId: getChainId() });

  if (proposal == null) nextNotFound();

  const { title: parsedTitle, body } = proposal;

  const title =
    parsedTitle == null
      ? `Prop ${params.id}`
      : `${parsedTitle} (Prop ${params.id})`;

  const firstRegularParagraph = messageUtils.stringifyBlocks(
    markdownUtils.toMessageBlocks(markdownUtils.getFirstParagraph(body ?? ""))
  );

  const description = stringUtils.truncate(220, firstRegularParagraph);

  const canonicalUrl = `${metaConfig.canonicalAppBasename}/proposals/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    twitter: {
      title,
      description,
      url: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
    },
  };
}

export default async function Page({ params }) {
  const proposal = await fetchProposal(params.id, {
    chainId: getChainId(),
  });

  if (proposal == null) nextNotFound();

  return (
    <ClientAppProvider>
      <ProposalScreen proposalId={params.id} />
      <StoreHydrater state={{ proposalsById: { [proposal.id]: proposal } }} />
    </ClientAppProvider>
  );
}
