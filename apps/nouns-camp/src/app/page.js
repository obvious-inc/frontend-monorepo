import ClientAppProvider from "./client-app-provider.js";
import BrowseScreen from "../components/browse-screen.js";

export const runtime = 'edge';

export default function Page() {
  return (
    <ClientAppProvider>
      <BrowseScreen />
    </ClientAppProvider>
  );
}
