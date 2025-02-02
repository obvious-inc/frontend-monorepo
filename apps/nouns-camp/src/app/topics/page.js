import ClientAppProvider from "../client-app-provider.js";
import { build as buildMetadata } from "../../utils/metadata.js";
import BrowseCandidatesScreen from "../../components/browse-candidates-screen.js";

export const metadata = buildMetadata({
  title: "Topics",
  canonicalPathname: "/topics",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseCandidatesScreen candidateType="topic" />
    </ClientAppProvider>
  );
}
