import ClientAppProvider from "@/app/client-app-provider";
import LandingScreen from "@/components/landing-screen";

export default function Page() {
  return (
    <ClientAppProvider>
      <LandingScreen />
    </ClientAppProvider>
  );
}
