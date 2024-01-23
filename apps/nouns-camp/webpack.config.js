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
        INFURA_PROJECT_ID: null,
        ALCHEMY_API_KEY: null,
        WALLET_CONNECT_PROJECT_ID: null,
        NOUNS_MAINNET_SUBGRAPH_URL: null,
        NOUNS_SEPOLIA_SUBGRAPH_URL: null,
        NOUNS_GOERLI_SUBGRAPH_URL: null,
        PROPDATES_SUBGRAPH_URL: null,
      }),
    ],
    resolve: {
      fallback: {
        tty: false,
        zlib: false,
        http: false,
        https: false,
        stream: false,
        os: false,
        fs: false,
        // os: require.resolve("os-browserify/browser"),
        // https: require.resolve("https-browserify"),
        // http: require.resolve("stream-http"),
        // assert: require.resolve("assert"),
        // stream: require.resolve("stream-browserify"),
        // url: require.resolve("url/"),
      },
    },
  };
};
