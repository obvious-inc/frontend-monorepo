const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");

require("dotenv").config();

module.exports = (_, argv, { htmlTitle, htmlDescription } = {}) => {
  const isProduction = argv.mode === "production";

  const config = {
    entry: "./src/web-entry.js",
    output: {
      filename: "[name].[contenthash].js",
      publicPath: "/",
      clean: true,
    },
    devServer: {
      historyApiFallback: {
        disableDotRule: true,
      },
      proxy: {
        "/api": {
          target: process.env.API_ENDPOINT ?? "http://localhost:5001",
          pathRewrite: { "^/api": "" },
          changeOrigin: true,
        },
        "/edge-api": {
          target: process.env.EDGE_API_ORIGIN,
          pathRewrite: { "^/edge-api": "/api" },
          changeOrigin: true,
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
          ],
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
        title: htmlTitle,
        description: htmlDescription,
        manifestPath: isProduction ? "/app.webmanifest" : null,
        isProduction,
      }),
      new webpack.DefinePlugin({
        "process.env.EDGE_API_BASE_URL": JSON.stringify(
          process.env.EDGE_API_ORIGIN == null ? "/api" : "/edge-api"
        ),
      }),
      new webpack.ProvidePlugin({
        process: "process/browser.js",
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    // All for WalletConnect to build T_T
    resolve: {
      fallback: {
        fs: false,
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
      new MiniCssExtractPlugin(),
      new CopyPlugin({ patterns: [{ from: "static" }] }),
      new WorkboxPlugin.GenerateSW({
        // these options encourage the ServiceWorkers to get in there fast
        // and not allow any straggling "old" SWs to hang around
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5000000, // 5 MB
      }),
    ],
    optimization: {
      moduleIds: "deterministic",
      runtimeChunk: "single",
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](viem|wagmi|@emotion|react|react-dom|react-router-dom|react-aria|pusher-js)[\\/]/,
            name: "vendors",
            chunks: "all",
          },
        },
      },
    },
  };
};
