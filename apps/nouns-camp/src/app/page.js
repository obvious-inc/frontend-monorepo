import ClientAppProvider from "./client-app-provider.js";
import LandingScreen from "../components/landing-screen.js";

export const runtime = 'edge';

export default function Page() {
  return (
    <ClientAppProvider>
      <LandingScreen />
    </ClientAppProvider>
  );
}
