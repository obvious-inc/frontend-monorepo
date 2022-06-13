const bundler = require("./electron-forge-bundler.js");

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
    // this is a workaround until we find a proper solution
    // for running electron-forge in a mono repository
    packageAfterCopy: async (
      /** @type {any} */ forgeConfig,
      /** @type {string} */ buildPath
    ) => {
      await bundler.bundle(__dirname, buildPath);
    },
  },
};
