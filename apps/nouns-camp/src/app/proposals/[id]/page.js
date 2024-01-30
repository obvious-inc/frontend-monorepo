import { mainnet } from "../../../chains.js";
import metaConfig from "../../../metadata-config.js";
import { subgraphFetch, parseProposal } from "../../../nouns-subgraph.js";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import ProposalScreenClientWrapper from "./page.client.js";

export const runtime = "edge";

// // Paginate to prevent exceeding the 2MB cache limit on Vercel
// const fetchProposals = async () => {
//   const pageSize = 100;
//   let proposals = [];
//   let page = 0;

//   while (page != null) {
//     const data = await subgraphFetch({
//       chainId: mainnet.id,
//       query: `
//         query {
//           proposals(
//             skip: ${page * pageSize},
//             first: ${pageSize},
//             orderBy: createdBlock,
//             orderDirection: desc
//           ) {
//             id
//             description
//           }
//         }`,
//     });
//     if (data.proposals == null || data.proposals.length === 0) break;
//     proposals.push(...data.proposals);
//     page = page + 1;
//   }

//   return proposals.map((p) => parseProposal(p, { chainId: mainnet.id }));
// };

const fetchProposal = async (id) => {
  const data = await subgraphFetch({
    chainId: mainnet.id,
    query: `
      query {
        proposal(id: ${id}) {
          id
          description
        }
      }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal, { chainId: mainnet.id });
};

// export async function generateStaticParams() {
//   const proposals = await fetchProposals();
//   return proposals.map((p) => ({ id: p.id, proposal: p }));
// }

export async function generateMetadata({ params }) {
  // const proposal = params.proposal ?? (await fetchProposal(params.id));
  const proposal = await fetchProposal(params.id);

  // Can’t notFound() here since we might be on a testnet
  if (proposal == null) return null;

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

export default function Page(props) {
  return <ProposalScreenClientWrapper {...props} />;
}
