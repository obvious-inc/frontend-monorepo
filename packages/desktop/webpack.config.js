const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const API_SERVER = process.env.API_SERVER ?? "http://localhost:5001";

module.exports = (_, argv) => {
  const isProduction = argv.mode === "production";

  const plugins = [
    new HtmlWebpackPlugin({ template: "src/index.web.html.ejs" }),
    new webpack.EnvironmentPlugin({
      API_ENDPOINT: isProduction ? null : "/api",
    }),
  ];

  if (isProduction)
    plugins.push(
      ...[
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
      ]
    );

  return {
    entry: "./src/web-entry.js",
    devServer: {
      proxy: {
        "/api": { target: API_SERVER, pathRewrite: { "^/api": "" } },
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
    plugins,
  };
};
