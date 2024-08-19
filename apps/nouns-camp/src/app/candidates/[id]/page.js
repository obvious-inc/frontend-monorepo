import { notFound as nextNotFound } from "next/navigation";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { subgraphFetch, parseCandidate } from "../../../nouns-subgraph.js";
import { normalizeId } from "../../../utils/candidates.js";
import { Hydrater as StoreHydrater } from "../../../store.js";
import ClientAppProvider from "../../client-app-provider.js";
import CandidateScreen from "../../../components/proposal-candidate-screen.js";

export const runtime = "edge";

const fetchCandidate = async (id) => {
  const data = await subgraphFetch({
    query: `
      query {
        proposalCandidate(id: ${JSON.stringify(id)}) {
          id
          slug
          proposer
          createdBlock
          canceledBlock
          lastUpdatedBlock
          canceledTimestamp
          createdTimestamp
          lastUpdatedTimestamp
          latestVersion {
            id
            content {
              description
              matchingProposalIds
              proposalIdToUpdate
            }
          }
        }
      }`,
  });

  if (data?.proposalCandidate == null) return null;

  return parseCandidate(data.proposalCandidate);
};
const parseId = (id) => normalizeId(decodeURIComponent(id));

export async function generateMetadata({ params }) {
  const candidateId = parseId(params.id);
  const candidate = await fetchCandidate(candidateId);

  // Can’t notFound() here since we might be on a testnet
  if (candidate == null) nextNotFound();

  const { title: parsedTitle, body } = candidate.latestVersion.content;

  const title = parsedTitle ?? "Untitled candidate";

  const firstRegularParagraph = messageUtils.stringifyBlocks(
    markdownUtils.toMessageBlocks(markdownUtils.getFirstParagraph(body ?? "")),
  );

  const description = stringUtils.truncate(220, firstRegularParagraph);

  const canonicalUrl = `${metaConfig.canonicalAppBasename}/candidates/${candidateId}`;

  const firstImage = markdownUtils.getFirstImage(body ?? "");

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
      images: firstImage?.url ?? "/opengraph-image.png",
    },
  };
}

export default async function Page({ params }) {
  const candidate = await fetchCandidate(parseId(params.id));

  if (candidate == null) nextNotFound();

  return (
    <ClientAppProvider>
      <CandidateScreen candidateId={candidate.id} />
      <StoreHydrater
        state={{ proposalCandidatesById: { [candidate.id]: candidate } }}
      />
    </ClientAppProvider>
  );
}
