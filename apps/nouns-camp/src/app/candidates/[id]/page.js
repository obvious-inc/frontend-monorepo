import { notFound as nextNotFound, permanentRedirect } from "next/navigation";
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
          number
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

const fetchCandidateByNumber = async (number) => {
  const data = await subgraphFetch({
    query: `
      query {
        proposalCandidates(where: {number: ${JSON.stringify(number)}}) {
          id
          slug
          number
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

  if (data?.proposalCandidates?.length == 0) return null;

  return parseCandidate(data.proposalCandidates[0]);
};

const parseId = (id) =>
  isNaN(Number(id)) ? normalizeId(decodeURIComponent(id)) : id;

export async function generateMetadata({ params }) {
  const candidateId = parseId(params.id);

  const candidate = isNaN(Number(params.id))
    ? await fetchCandidate(parseId(params.id))
    : await fetchCandidateByNumber(params.id);

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
      card: firstImage?.url ? "summary_large_image" : "summary",
      images: firstImage?.url ?? "/opengraph-image.png",
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
  const candidate = isNaN(Number(params.id))
    ? await fetchCandidate(parseId(params.id))
    : await fetchCandidateByNumber(params.id);

  if (candidate == null) nextNotFound();

  if (!isNaN(Number(params.id))) {
    permanentRedirect(`/candidates/${candidate.id}`);
  }

  return (
    <ClientAppProvider>
      <CandidateScreen candidateId={candidate.id} />
      <StoreHydrater
        state={{ proposalCandidatesById: { [candidate.id]: candidate } }}
      />
    </ClientAppProvider>
  );
}
