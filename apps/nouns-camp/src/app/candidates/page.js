import ClientAppProvider from "../client-app-provider.js";
import BrowseCandidatesScreen from "../../components/browse-candidates-screen.js";

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseCandidatesScreen />
    </ClientAppProvider>
  );
}
