if (!process.env.CI) require("dotenv").config();

module.exports = {
  name: "NOM",
  slug: "newshades",
  owner: "newshades",
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "nom",
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
  userInterfaceStyle: "dark",
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
    gitCommitSha: process.env.GITHUB_SHA,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  plugins: [
    "expo-localization",
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app accesses your photos to let you share them with your friends.",
        // cameraPermission: "",
      },
    ],
  ],
};
