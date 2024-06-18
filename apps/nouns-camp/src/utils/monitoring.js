import * as Sentry from "@sentry/nextjs";

export const reportError = (error) => Sentry.captureException(error);
