const webpack = require("webpack");
const { withSentryConfig } = require("@sentry/nextjs");

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
      // Suppresses source map uploading logs during build
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
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
      automaticVercelMonitors: true,
    },
  );

const BUILD_ID = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? "dev";

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
          source: "/subgraphs/nouns-mainnet",
          destination: process.env.NOUNS_SUBGRAPH_MAINNET_URL,
        },
        {
          source: "/subgraphs/nouns-sepolia",
          destination: process.env.NOUNS_SUBGRAPH_SEPOLIA_URL,
        },
        {
          source: "/subgraphs/propdates-mainnet",
          destination: process.env.PROPDATES_SUBGRAPH_MAINNET_URL,
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
        }),
      ];

      return config;
    },
    experimental: {
      turbo: {
        // Ignoring modules is not a thing yet
        resolveAlias: Object.fromEntries(
          ignoredModules.map((n) => [n, "@shades/common"]),
        ),
      },
    },
  }),
);
