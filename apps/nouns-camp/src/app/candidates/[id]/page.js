import { headers } from "next/headers";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../../../wagmi-config.js";
import { subgraphFetch, parseCandidate } from "../../../nouns-subgraph.js";
import { normalizeId } from "../../../utils/candidates.js";
import CandidateScreenClientWrapper from "./page.client.js";

export const runtime = "edge";

const fetchCandidate = async (id, { chainId }) => {
  const data = await subgraphFetch({
    chainId,
    query: `
      query {
        proposalCandidate(id: "${id}") {
          id
          latestVersion {
            content {
              description
            }
          }
        }
      }`,
  });

  if (data?.proposalCandidate == null) return null;

  return parseCandidate(data.proposalCandidate, { chainId });
};

export async function generateMetadata({ params }) {
  const wagmiState = getWagmiStateFromCookie(headers().get("cookie"));
  const candidateId = normalizeId(decodeURIComponent(params.id));
  const candidate = await fetchCandidate(candidateId, {
    chainId: wagmiState.chainId,
  });

  // Can’t notFound() here since we might be on a testnet
  if (candidate == null) return null;

  const { title: parsedTitle, body } = candidate.latestVersion.content;

  const title = parsedTitle ?? "Untitled candidate";

  const firstRegularParagraph = messageUtils.stringifyBlocks(
    markdownUtils.toMessageBlocks(markdownUtils.getFirstParagraph(body ?? ""))
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

export default function Page(props) {
  return <CandidateScreenClientWrapper {...props} />;
}
