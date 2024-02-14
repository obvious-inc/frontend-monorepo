const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/service-worker.js",
  swDest: "public/service-worker.js",
  swUrl: "/service-worker.js",
});

const ignoredModules = [
  // @prophouse/sdk
  "fs",
  "http",
  "https",
  "os",
  "stream",
  "tty",
  "zlib",
  // wagmi / @walletconnect
  "pino-pretty",
  // wagmi / @metamask
  "encoding",
];

module.exports = withSerwist({
  reactStrictMode: true,
  compiler: {
    emotion: true,
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "x-build-id",
            value: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
          },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...Object.fromEntries(ignoredModules.map((m) => [m, false])),
    };

    return config;
  },
  experimental: {
    turbo: {
      // Ignoring modules is not a thing yet
      resolveAlias: Object.fromEntries(
        ignoredModules.map((n) => [n, "@shades/common"])
      ),
    },
  },
});
