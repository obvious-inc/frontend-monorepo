const { readFileSync } = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const webpack = require("webpack");
const { withSentryConfig } = require("@sentry/nextjs");

// `next lint` runs this file
const isLintJob = process.env.CI_LINT != null;

// Assert environment variables are setup correctly
const assertEnvironment = () => {
  // Skip this check in CI lint jobs
  if (isLintJob) return;

  const templateFile = readFileSync(path.join(__dirname, ".env.template"));
  const whitelistedKeys = Object.keys(dotenv.parse(templateFile));

  // Assert that required (all whitelisted) variables are defined
  for (const key of whitelistedKeys)
    if (process.env[key] == null) throw new Error(`${key} is not defined`);

  // Assert that any public keys are defined in the whitelist
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_VERCEL_")) continue; // Variables injected by Vercel are fine
  //   if (key.startsWith("NEXT_PUBLIC_") && !whitelistedKeys.includes(key))
  //     throw new Error(`${key} is not allowed`);
  }
};

try {
  assertEnvironment();
} catch (e) {
  if (process.env.NODE_ENV === "production") throw e;
  console.warn("Incomplete environment", e);
}

const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/service-worker.js",
  swDest: "public/service-worker.js",
  swUrl: "/service-worker.js",
  disable: process.env.NODE_ENV !== "production",
});

const withSentry = (config) =>
  withSentryConfig(
    config,
    {
      silent: true, // Suppresses source map uploading logs during build
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
    {
      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,
      // Transpiles SDK to be compatible with IE11 (increases bundle size)
      transpileClientSDK: true,
      // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
      tunnelRoute: "/monitoring",
      // Hides source maps from generated client bundles
      hideSourceMaps: true,
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,
      // Enables automatic instrumentation of Vercel Cron Monitors.
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      // automaticVercelMonitors: true,
    },
  );

const BUILD_ID = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? "dev";
const APP_HOST = (() => {
  if (process.env.APP_HOST != null) return process.env.APP_HOST;
  if (process.env.VERCEL == null && !isLintJob)
    throw new Error("`APP_HOST` not set");
  return {
    production: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    preview: process.env.VERCEL_BRANCH_URL,
  }[process.env.VERCEL_ENV];
})();
const APP_PRODUCTION_URL = (() => {
  if (process.env.APP_PRODUCTION_URL != null)
    return process.env.APP_PRODUCTION_URL;
  if (process.env.VERCEL == null) return `https://${APP_HOST}`;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL;
})();

const ignoredModules = [
  // @nouns/sdk
  "fs",
  // wagmi / @walletconnect
  "pino-pretty",
  // wagmi / @metamask
  "encoding",
];

module.exports = withSentry(
  withSerwist({
    reactStrictMode: true,
    compiler: {
      emotion: true,
    },
    rewrites() {
      return [
        { source: "/sw.js", destination: "/service-worker.js" },
        {
          source: "/subgraphs/nouns",
          destination: process.env.NOUNS_SUBGRAPH_URL,
        },
        {
          source: "/subgraphs/propdates",
          destination: process.env.PROPDATES_SUBGRAPH_URL,
        },
      ];
    },
    headers() {
      return [
        {
          source: "/:path*",
          headers: [{ key: "x-camp-build-id", value: BUILD_ID }],
        },
      ];
    },
    webpack(config) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...Object.fromEntries(ignoredModules.map((m) => [m, false])),
      };

      config.plugins = [
        ...config.plugins,
        new webpack.DefinePlugin({
          "process.env.BUILD_ID": JSON.stringify(BUILD_ID),
          "process.env.APP_HOST": JSON.stringify(APP_HOST),
          "process.env.APP_PRODUCTION_URL": JSON.stringify(APP_PRODUCTION_URL),
        }),
      ];

      return config;
    },
    experimental: {
      turbo: {
        // Ignoring modules is not a thing yet
        resolveAlias: Object.fromEntries(
          ignoredModules.map((n) => [
            n,
            { browser: "@shades/common/empty-module" },
          ]),
        ),
      },
      instrumentationHook: process.env.NODE_ENV === 'production',
    },
  }),
);
