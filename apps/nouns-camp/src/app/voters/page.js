import ClientAppProvider from "../client-app-provider.js";
import BrowseAccountsScreen from "../../components/browse-accounts-screen.js";

export const runtime = "edge";

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseAccountsScreen />
    </ClientAppProvider>
  );
}
