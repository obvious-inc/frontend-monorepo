"use client";

import Spinner from "@shades/ui-web/spinner";
import ClientAppProvider from "./client-app-provider.js";
import Layout from "../components/layout.js";

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
