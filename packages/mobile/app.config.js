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
    url: process.env.EXPO_UPDATES_URL,
  },
  assetBundlePatterns: ["**/*"],
  runtimeVersion: { policy: "sdkVersion" },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "dev.newshades",
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
    infuraProjectId: process.env.INFURA_PROJECT_ID,
    cloudflareAccountHash: process.env.CLOUDFLARE_ACCOUNT_HASH,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};
