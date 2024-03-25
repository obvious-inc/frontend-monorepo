"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import ClientAppProvider from "./client-app-provider.js";
import ErrorScreen from "../components/error-screen.js";

export default function Error({
  error,
  // reset
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ClientAppProvider>
      <ErrorScreen
        title="Camp broke!"
        description="Garbage software..."
        imageSrc="https://media1.tenor.com/m/2TE2ws3_4z8AAAAC/nouns-dao.gif"
        linkHref="/"
        linkLabel="Back to safety"
        error={error}
      />
    </ClientAppProvider>
  );
}
