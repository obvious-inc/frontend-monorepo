import ClientAppProvider from "../client-app-provider.js";
import BrowseCandidatesScreen from "../../components/browse-candidates-screen.js";

export const runtime = "edge";

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseCandidatesScreen />
    </ClientAppProvider>
  );
}
