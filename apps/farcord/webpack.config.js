const webpack = require("webpack");
const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args, { htmlTitle: "Farcord" });
  return {
    ...config,
    entry: "./src/entry.js",
    plugins: [
      ...config.plugins,
      new webpack.EnvironmentPlugin({
        PUSHER_KEY: undefined,
        FARCASTER_HUB_RPC_ENDPOINT: undefined,
        NEYNAR_API_KEY: undefined,
        INFURA_PROJECT_ID: null,
        WALLET_CONNECT_PROJECT_ID: null,
        WARPCAST_API_TOKEN: null,
        FARCORD_APP_FID: null,
        FARCORD_APP_MNEMONIC: null,
        IMGUR_CLIENT_ID: null,
      }),
    ],
  };
};
