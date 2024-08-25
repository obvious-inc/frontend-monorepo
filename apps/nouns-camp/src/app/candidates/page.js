import ClientAppProvider from "../client-app-provider.js";
import { build as buildMetadata } from "../../utils/metadata.js";
import BrowseCandidatesScreen from "../../components/browse-candidates-screen.js";

export const runtime = "edge";

export const metadata = buildMetadata({
  title: "Candidates",
  canonicalPathname: "/candidates",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseCandidatesScreen />
    </ClientAppProvider>
  );
}
