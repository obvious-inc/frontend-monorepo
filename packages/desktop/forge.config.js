module.exports = {
  packagerConfig: {},
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
};
