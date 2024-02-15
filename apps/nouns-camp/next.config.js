const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/service-worker.js",
  swDest: "public/service-worker.js",
  swUrl: "/service-worker.js",
  disable: process.env.NODE_ENV !== "production",
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
  rewrites() {
    return [{ source: "/sw.js", destination: "/service-worker.js" }];
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
