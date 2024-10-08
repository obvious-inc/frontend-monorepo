import ClientAppProvider from "@/app/client-app-provider";
import { build as buildMetadata } from "@/utils/metadata";
import AuctionScreen from "@/components/auction-screen";

export const metadata = buildMetadata({
  title: "Auction",
  canonicalPathname: "/auction",
});

export default function Page() {
  return (
    <ClientAppProvider>
      <AuctionScreen />
    </ClientAppProvider>
  );
}
