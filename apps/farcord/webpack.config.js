const webpack = require("webpack");
const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args);
  return {
    ...config,
    entry: "./src/entry.js",
    plugins: [
      ...config.plugins,
      new webpack.EnvironmentPlugin({
        PUSHER_KEY: undefined,
        FARCASTER_HUB_RPC_ENDPOINT: undefined,
        NEYNAR_API_KEY: undefined,
      }),
    ],
  };
};
