import { mainnet } from "../../../chains.js";
import metaConfig from "../../../metadata-config.js";
import { subgraphFetch, parseCandidate } from "../../../nouns-subgraph.js";
import { normalizeId } from "../../../utils/candidates.js";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import CandidateScreenClientWrapper from "./page.client.js";

export const runtime = "edge";

// // Paginate to prevent exceeding the 2MB cache limit on Vercel
// const fetchCandidates = async () => {
//   const pageSize = 100;
//   let candidates = [];
//   let page = 0;

//   while (page != null) {
//     const { proposalCandidates: pageCandidates } = await subgraphFetch({
//       chainId: mainnet.id,
//       query: `
//         query {
//           proposalCandidates(
//             skip: ${page * pageSize},
//             first: ${pageSize},
//             orderBy: createdBlock,
//             orderDirection: desc
//           ) {
//             id
//             latestVersion {
//               content {
//                 description
//               }
//             }
//           }
//         }`,
//     });
//     if (pageCandidates == null || pageCandidates.length === 0) break;
//     candidates.push(...pageCandidates);
//     page = page + 1;
//   }

//   return candidates.map((c) => parseCandidate(c, { chainId: mainnet.id }));
// };

const fetchCandidate = async (id) => {
  const data = await subgraphFetch({
    chainId: mainnet.id,
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

  return parseCandidate(data.proposalCandidate, { chainId: mainnet.id });
};

// export async function generateStaticParams() {
//   const candidates = await fetchCandidates();
//   return candidates.map((c) => ({
//     id: encodeURIComponent(c.id),
//     candidate: c,
//   }));
// }

export async function generateMetadata({ params }) {
  const candidateId = normalizeId(decodeURIComponent(params.id));
  // const candidate = params.candidate ?? (await fetchCandidate(candidateId));
  const candidate = await fetchCandidate(candidateId);

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
