import ClientAppProvider from "@/app/client-app-provider";
import { build as buildMetadata } from "@/utils/metadata";
import NounScreen from "@/components/noun-screen";

export const metadata = buildMetadata({
  title: "Auction",
  canonicalPathname: "/auction",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <NounScreen />
    </ClientAppProvider>
  );
}
