const path = require("path");
const WorkboxPlugin = require("workbox-webpack-plugin");

module.exports = {
  reactStrictMode: true,
  compiler: {
    emotion: true,
  },
  webpack(config, { dev, ...options }) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // @prophouse/sdk
      fs: false,
      http: false,
      https: false,
      os: false,
      stream: false,
      tty: false,
      zlib: false,
      // @walletconnect
      "pino-pretty": false,
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
};
