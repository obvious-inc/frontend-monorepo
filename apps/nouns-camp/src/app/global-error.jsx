"use client";

import React from "react";
import { reportError } from "@/utils/monitoring";
import EmotionRootStyleRegistry from "@/app/emotion-style-root-registry";
import ThemeProvider from "@/theme-provider";
import ErrorScreen from "@/components/error-screen";

export default function Error({ error }) {
  React.useEffect(() => {
    reportError(error);
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
