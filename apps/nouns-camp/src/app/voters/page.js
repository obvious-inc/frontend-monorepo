import ClientAppProvider from "../client-app-provider.js";
import { build as buildMetadata } from "../../utils/metadata.js";
import BrowseAccountsScreen from "../../components/browse-accounts-screen.js";

export const runtime = "edge";

export const metadata = buildMetadata({
  title: "Voters",
  canonicalPathname: "/voters",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseAccountsScreen />
    </ClientAppProvider>
  );
}
