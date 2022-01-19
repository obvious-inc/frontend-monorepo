const devServerConfig = require("./webpack.shared.dev-server.js");

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
        prerelease: true,
      },
    },
  ],
  plugins: [
    [
      "@electron-forge/plugin-webpack",
      {
        devServer: devServerConfig,
        devContentSecurityPolicy:
          "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:; connect-src *",
        mainConfig: "./webpack.main.config.js",
        renderer: {
          config: "./webpack.renderer.config.js",
          entryPoints: [
            {
              html: "./src/index.html",
              js: "./src/app.js",
              name: "main_window",
            },
          ],
        },
      },
    ],
  ],
};
