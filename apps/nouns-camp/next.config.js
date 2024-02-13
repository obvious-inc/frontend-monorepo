const path = require("path");
const WorkboxPlugin = require("workbox-webpack-plugin");

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

module.exports = {
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
  webpack(config, { dev, ...options }) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...Object.fromEntries(ignoredModules.map((m) => [m, false])),
    };

    if (dev) return config;

    return {
      ...config,
      plugins: [
        ...config.plugins,
        new WorkboxPlugin.GenerateSW({
          swDest: path.join(options.dir, "public", "sw.js"),
          // these options encourage the ServiceWorkers to get in there fast
          // and not allow any straggling "old" SWs to hang around
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5000000, // 5 MB
        }),
      ],
    };
  },
  experimental: {
    turbo: {
      // Ignoring modules is not a thing yet
      resolveAlias: Object.fromEntries(
        ignoredModules.map((n) => [n, "@shades/common"])
      ),
    },
  },
};
