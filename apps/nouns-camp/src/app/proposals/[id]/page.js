import { headers } from "next/headers";
import {
  string as stringUtils,
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import metaConfig from "../../../metadata-config.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../../../wagmi-config.js";
import { subgraphFetch, parseProposal } from "../../../nouns-subgraph.js";
import ProposalScreenClientWrapper from "./page.client.js";

export const runtime = "edge";

const fetchProposal = async (id, { chainId }) => {
  const data = await subgraphFetch({
    chainId,
    query: `
      query {
        proposal(id: ${id}) {
          id
          description
        }
      }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal, { chainId });
};

export async function generateMetadata({ params }) {
  const wagmiState = getWagmiStateFromCookie(headers().get("cookie"));
  const proposal = await fetchProposal(params.id, {
    chainId: wagmiState.chainId,
  });

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
