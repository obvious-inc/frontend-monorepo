const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const isProduction = args[1].mode === "production";
  const config = createConfig(...args, { htmlTitle: "NOM" });

  const plugins = !isProduction
    ? config.plugins
    : [
      ...config.plugins,
      new webpack.EnvironmentPlugin({
        PUSHER_KEY: undefined,
        INFURA_PROJECT_ID: null,
        CLOUDFLARE_ACCT_HASH: null,
        DEV: null,
        SENTRY_DSN: null,
        WALLET_CONNECT_PROJECT_ID: null,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              "../../apps/obvious-landing/public/favicon-32x32.png"
            ),
          },
          {
            from: path.resolve(
              __dirname,
              "../../apps/obvious-landing/public/favicon-192x192.png"
            ),
          },
        ],
      }),
    ];

  return {
    ...config,
    entry: "./src/web-entry.js",
    plugins,
  };
};
