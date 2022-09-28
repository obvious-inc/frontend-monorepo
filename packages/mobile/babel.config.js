// require("dotenv").config();

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // [
      //   "transform-inline-environment-variables",
      //   {
      //     include: [
      //       "NODE_ENV",
      //       "PUSHER_KEY",
      //       "API_ENDPOINT",
      //       "WEB_APP_ENDPOINT",
      //     ],
      //   },
      // ],
      "react-native-reanimated/plugin",
    ],
  };
};
