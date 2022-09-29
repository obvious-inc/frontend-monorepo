require("dotenv").config();

module.exports = {
  name: "newshades-mobile",
  slug: "newshades",
  owner: "newshades",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    apiEndpoint: process.env.API_ENDPOINT,
    webAppEndpoint: process.env.WEB_APP_ENDPOINT,
    pusherKey: process.env.PUSHER_KEY,
  },
};
