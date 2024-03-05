// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://7caee2a8b496a136788465da5f07901b@o365721.ingest.us.sentry.io/4506858504650752",
  tracesSampleRate: 0,
});
