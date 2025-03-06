"use client";

import Spinner from "@shades/ui-web/spinner";
import ClientAppProvider from "@/app/client-app-provider";
import Layout from "@/components/layout";

export default function Loading() {
  return (
    <ClientAppProvider>
      <Layout>
        <div
          style={{
            flex: 1,
            height: "100%",
            width: "100%",
            display: "flex",
            placeContent: "center",
            paddingBottom: "10vh",
          }}
        >
          <Spinner size="2rem" />
        </div>
      </Layout>
    </ClientAppProvider>
  );
}
