import ClientAppProvider from "@/app/client-app-provider";
import { build as buildMetadata } from "@/utils/metadata";
import BrowseAccountsScreen from "@/components/browse-accounts-screen";

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
