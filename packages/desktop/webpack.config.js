const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const API_SERVER = process.env.API_SERVER ?? "http://localhost:5001";

module.exports = (_, argv) => {
  return {
    entry: "./src/web-entry.js",
    devServer: {
      proxy: {
        "/api": {
          target: API_SERVER,
          pathRewrite: { "^/api": "" },
        },
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
      new webpack.EnvironmentPlugin({
        API_ENDPOINT: argv.mode === "production" ? null : "/api",
      }),
      new HtmlWebpackPlugin({ template: "src/index.web.html.ejs" }),
    ],
  };
};
