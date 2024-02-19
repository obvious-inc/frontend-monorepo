"use client";

import ClientAppProvider from "./client-app-provider.js";
import ErrorScreen from "../components/error-screen.js";

export default function Error({
  error,
  // reset
}) {
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
