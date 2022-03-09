const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const API_ENDPOINT = process.env.API_ENDPOINT ?? "http://localhost:5001";

module.exports = (_, argv) => {
  const isProduction = argv.mode === "production";

  const config = {
    entry: "./src/web-entry.js",
    output: {
      filename: "[name].[contenthash].js",
      publicPath: "/",
      clean: true,
    },
    devServer: {
      historyApiFallback: true,
      proxy: {
        "/api": { target: API_ENDPOINT, pathRewrite: { "^/api": "" } },
      },
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [{ loader: "style-loader" }, { loader: "css-loader" }],
        },
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: {
            // See `.swcrc` for config
            loader: "swc-loader",
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "src/index.web.html.ejs",
        title: "NewShades",
      }),
      new webpack.EnvironmentPlugin({
        API_ENDPOINT: isProduction ? null : "/api",
        PUSHER_KEY: null,
        INFURA_PROJECT_ID: null,
        SENTRY_DSN: null,
        DEV: null,
      }),
      new webpack.ProvidePlugin({
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    // All for WalletConnect to build T_T
    resolve: {
      fallback: {
        os: require.resolve("os-browserify/browser"),
        https: require.resolve("https-browserify"),
        http: require.resolve("stream-http"),
        assert: require.resolve("assert"),
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url/"),
      },
    },
  };

  if (!isProduction) return config;

  return {
    ...config,
    plugins: [
      ...config.plugins,
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              "../landing/public/favicon-16x16.png"
            ),
          },
          {
            from: path.resolve(
              __dirname,
              "../landing/public/favicon-32x32.png"
            ),
          },
        ],
      }),
    ],
    optimization: {
      moduleIds: "deterministic",
      runtimeChunk: "single",
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-intl|react-router-dom|pusher-js)[\\/]/,
            name: "vendors",
            chunks: "all",
          },
        },
      },
    },
  };
};
