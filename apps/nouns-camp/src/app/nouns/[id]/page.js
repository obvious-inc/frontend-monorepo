import { notFound as nextNotFound } from "next/navigation";
import { subgraphFetch } from "@/nouns-subgraph";
import ClientAppProvider from "@/app/client-app-provider";
import NounScreen from "@/components/noun-screen";

const fetchNoun = async (id) => {
  const data = await subgraphFetch({
    query: `{
      noun(id: ${id}) {
        id
      }
    }`,
  });

  return data?.noun;
};

export async function generateMetadata(props) {
  const params = await props.params;
  const noun = await fetchNoun(params.id);

  // Can’t notFound() here since we might be on a testnet
  if (noun == null) nextNotFound();

  const title = `Noun ${params.id}`;

  return {
    title,
    twitter: { title },
    openGraph: { title },
  };
}

export default async function Page(props) {
  const params = await props.params;
  return (
    <ClientAppProvider>
      <NounScreen nounId={params.id} />
    </ClientAppProvider>
  );
}
