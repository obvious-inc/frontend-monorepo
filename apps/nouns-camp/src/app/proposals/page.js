import ClientAppProvider from "../client-app-provider.js";
import BrowseProposalsScreen from "../../components/browse-proposals-screen.js";

export const runtime = "edge";

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseProposalsScreen />
    </ClientAppProvider>
  );
}
