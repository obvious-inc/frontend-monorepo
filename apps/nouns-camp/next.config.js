const webpack = require("webpack");

const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/service-worker.js",
  swDest: "public/service-worker.js",
  swUrl: "/service-worker.js",
  disable: process.env.NODE_ENV !== "production",
});

const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

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

    config.plugins = [
      ...config.plugins,
      new webpack.DefinePlugin({
        "process.env.BUILD_ID": JSON.stringify(BUILD_ID),
      }),
    ];

    return config;
  },
  experimental: {
    cpus: 4,
    turbo: {
      // Ignoring modules is not a thing yet
      resolveAlias: Object.fromEntries(
        ignoredModules.map((n) => [n, "@shades/common"]),
      ),
    },
  },
});
