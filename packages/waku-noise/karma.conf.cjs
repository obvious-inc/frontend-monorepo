process.env.CHROME_BIN = require("puppeteer").executablePath();

const os = require("os");
const path = require("path");
const ResolveTypeScriptPlugin = require("resolve-typescript-plugin");

const output = {
  path: path.join(os.tmpdir(), "_karma_webpack_") + Math.floor(Math.random() * 1000000),
};

module.exports = function (config) {
  config.set({
    frameworks: ["webpack", "mocha"],
    preprocessors: {
      "**/*.ts": ["webpack"],
    },

    files: [
      "src/**/*.spec.ts",
      "src/**/*.ts",
      {
        pattern: `${output.path}/**/*`,
        watched: false,
        included: false,
        served: true,
      },
    ],
    envPreprocessor: ["CI"],
    reporters: ["progress"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000, // Default is 2s
      },
    },
    webpack: {
      mode: "production",
      optimization: {
        // minification is disabled due to an issue with missing variable
        // https://github.com/waku-org/js-noise/pull/18#discussion_r1100712310
        minimize: false,
      },
      resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: [".ts", ".tsx", ".js"],
        plugins: [new ResolveTypeScriptPlugin()],
      },
      module: {
        rules: [
          {
            test: /\.wasm$/,
            type: "asset/resource",
          },
          {
            test: /\.(js|tsx?)$/,
            loader: "ts-loader",
            exclude: /node_modules|\.d\.ts$/,
            options: { configFile: "tsconfig.karma.json" },
          },
          {
            test: /\.d\.ts$/,
            loader: "ignore-loader",
          },
        ],
      },
      output,
    },
  });
};
