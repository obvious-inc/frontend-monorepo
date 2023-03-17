const fs = require("fs");
const bundler = require("./electron-forge-bundler.js");

const DEFAULT_DEV_APP_URL = "http://localhost:8080";

module.exports = {
  packagerConfig: {
    prune: false,
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      platforms: ["darwin"],
      config: {
        repository: {
          owner: "NewShadesDAO",
          name: "front",
        },
      },
    },
  ],
  hooks: {
    generateAssets: async () => {
      const APP_URL = process.env.APP_URL ?? DEFAULT_DEV_APP_URL;
      fs.writeFileSync("./build-constants.json", JSON.stringify({ APP_URL }));
    },
    // this is a workaround until we find a proper solution
    // for running electron-forge in a mono repository
    packageAfterCopy: async (_, buildPath) => {
      await bundler.bundle(__dirname, buildPath);
    },
  },
};
