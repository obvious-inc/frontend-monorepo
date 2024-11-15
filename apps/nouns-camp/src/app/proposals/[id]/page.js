import { notFound as nextNotFound } from "next/navigation";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { subgraphFetch, parseProposal } from "../../../nouns-subgraph.js";
import { Hydrater as StoreHydrater } from "../../../store.js";
import ClientAppProvider from "../../client-app-provider.js";
import ProposalScreen from "../../../components/proposal-screen.js";

const fetchProposal = async (id) => {
  const data = await subgraphFetch({
    query: `
      query {
        proposal(id: ${id}) {
          id
          description
          status
          createdBlock
          createdTimestamp
          lastUpdatedBlock
          lastUpdatedTimestamp
          startBlock
          endBlock
          updatePeriodEndBlock
          objectionPeriodEndBlock
          canceledBlock
          canceledTimestamp
          queuedBlock
          queuedTimestamp
          executedBlock
          executedTimestamp
          forVotes
          againstVotes
          abstainVotes
          quorumVotes
          executionETA
          proposer {
            id
          }
          signers {
            id
          }
        }
      }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal);
};

export async function generateMetadata({ params, searchParams }) {
  const { vwr } = searchParams;
  // could fetch the vote and show its info in the title/description og tags

  const proposal = await fetchProposal(params.id);
  if (proposal == null) nextNotFound();

  const { title: parsedTitle, body } = proposal;

  const title =
    parsedTitle == null
      ? `Prop ${params.id}`
      : `${parsedTitle} (Prop ${params.id})`;

  const firstRegularParagraph = messageUtils.stringifyBlocks(
    markdownUtils.toMessageBlocks(markdownUtils.getFirstParagraph(body ?? "")),
  );

  const description = stringUtils.truncate(220, firstRegularParagraph);

  const canonicalUrl = `${metaConfig.canonicalAppBasename}/proposals/${params.id}`;

  const firstImage = markdownUtils.getFirstImage(body ?? "");

  const og =
    vwr != null
      ? {
          title,
          description,
          url: canonicalUrl,
          images: `${metaConfig.canonicalAppBasename}/api/og/vwrs?id=${vwr}`,
        }
      : {
          title,
          description,
          url: canonicalUrl,
          images: firstImage?.url ?? "/opengraph-image.png",
        };

  const frame =
    vwr != null
      ? {
          "fc:frame": "vNext",
          "fc:frame:image": `${metaConfig.canonicalAppBasename}/api/og/vwrs?id=${vwr}`,
          "fc:frame:button:1": "View Vote",
          "fc:frame:button:1:action": "link",
          "fc:frame:button:1:target": canonicalUrl,
        }
      : firstImage?.url
        ? {}
        : {
            "fc:frame": "vNext",
            "fc:frame:image": `${metaConfig.canonicalAppBasename}/api/og?proposal=${params.id}`,
            "fc:frame:button:1": "View proposal",
            "fc:frame:button:1:action": "link",
            "fc:frame:button:1:target": canonicalUrl,
          };

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    twitter: {
      title,
      description,
      url: canonicalUrl,
      card: firstImage?.url ? "summary_large_image" : "summary",
      images: firstImage?.url ?? "/opengraph-image.png",
    },
    openGraph: og,
    other: frame,
  };
}

export default async function Page({ params }) {
  const proposal = await fetchProposal(params.id);

  if (proposal == null) nextNotFound();

  return (
    <ClientAppProvider>
      <ProposalScreen proposalId={params.id} />
      <StoreHydrater state={{ proposalsById: { [proposal.id]: proposal } }} />
    </ClientAppProvider>
  );
}
