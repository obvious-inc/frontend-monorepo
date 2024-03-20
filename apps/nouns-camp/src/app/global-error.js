"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import EmotionRootStyleRegistry from "./emotion-style-root-registry.js";
import ThemeProvider from "../theme-provider.js";
import ErrorScreen from "../components/error-screen.js";

export default function Error({ error }) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <EmotionRootStyleRegistry>
          <ThemeProvider>
            <ErrorScreen
              title="Camp broke!"
              description="Garbage software..."
              imageSrc="https://media1.tenor.com/m/2TE2ws3_4z8AAAAC/nouns-dao.gif"
              linkHref="/"
              linkLabel="Back to safety"
              error={error}
            />
          </ThemeProvider>
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
