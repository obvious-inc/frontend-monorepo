if (!process.env.CI) require("dotenv").config();

console.log(process.env)

module.exports = {
  name: "NewShades",
  slug: "newshades",
  owner: "newshades",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "newshades",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
  assetBundlePatterns: ["**/*"],
  runtimeVersion: { policy: "sdkVersion" },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "xyz.newshades.newshades",
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
