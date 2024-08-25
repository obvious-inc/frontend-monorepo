import ClientAppProvider from "../client-app-provider.js";
import { build as buildMetadata } from "../../utils/metadata.js";
import BrowseProposalsScreen from "../../components/browse-proposals-screen.js";

export const runtime = "edge";

export const metadata = buildMetadata({
  title: "Proposals",
  canonicalPathname: "/proposals",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseProposalsScreen />
    </ClientAppProvider>
  );
}
