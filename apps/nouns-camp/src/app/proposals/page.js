import ClientAppProvider from "../client-app-provider.js";
import BrowseProposalsScreen from "../../components/browse-proposals-screen.js";

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseProposalsScreen />
    </ClientAppProvider>
  );
}
