import { headers } from "next/headers";
import { notFound as nextNotFound } from "next/navigation";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../../../wagmi-config.js";
import { subgraphFetch, parseCandidate } from "../../../nouns-subgraph.js";
import { normalizeId } from "../../../utils/candidates.js";
import { mainnet } from "../../../chains.js";
import { Hydrater as StoreHydrater } from "../../../store.js";
import ClientAppProvider from "../../client-app-provider.js";
import CandidateScreen from "../../../components/proposal-candidate-screen.js";

export const runtime = "edge";

const getChainId = () => {
  const wagmiState = getWagmiStateFromCookie(headers().get("cookie"));
  return wagmiState?.chainId ?? mainnet.id;
};

const fetchCandidate = async (id, { chainId }) => {
  const data = await subgraphFetch({
    chainId,
    query: `
      query {
        proposalCandidate(id: "${id}") {
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

  return parseCandidate(data.proposalCandidate, { chainId });
};
const parseId = (id) => normalizeId(decodeURIComponent(id));

export async function generateMetadata({ params }) {
  const candidateId = parseId(params.id);
  const candidate = await fetchCandidate(candidateId, {
    chainId: getChainId(),
  });

  // Can’t notFound() here since we might be on a testnet
  if (candidate == null) nextNotFound();

  const { title: parsedTitle, body } = candidate.latestVersion.content;

  const title = parsedTitle ?? "Untitled candidate";

  const firstRegularParagraph = messageUtils.stringifyBlocks(
    markdownUtils.toMessageBlocks(markdownUtils.getFirstParagraph(body ?? "")),
  );

  const description = stringUtils.truncate(220, firstRegularParagraph);

  const canonicalUrl = `${metaConfig.canonicalAppBasename}/candidates/${candidateId}`;

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
  const candidate = await fetchCandidate(parseId(params.id), {
    chainId: getChainId(),
  });

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
