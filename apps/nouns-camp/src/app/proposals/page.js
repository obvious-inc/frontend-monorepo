import ClientAppProvider from "@/app/client-app-provider";
import { build as buildMetadata } from "@/utils/metadata";
import BrowseProposalsScreen from "@/components/browse-proposals-screen";

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
