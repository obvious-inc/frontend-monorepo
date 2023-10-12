const webpack = require("webpack");
const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args, {
    htmlTitle: "Nouns Camp",
    htmlDescription: "A Nouns governance client",
  });
  return {
    ...config,
    entry: "./src/entry.js",
    plugins: [
      ...config.plugins,
      new webpack.EnvironmentPlugin({
        PUSHER_KEY: undefined,
        INFURA_PROJECT_ID: null,
        ALCHEMY_API_KEY: null,
        CLOUDFLARE_ACCT_HASH: null,
        WALLET_CONNECT_PROJECT_ID: null,
        NOUNS_SUBGRAPH_URL: null,
        PROPDATES_SUBGRAPH_URL: null,
      }),
    ],
  };
};
