const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webConfig = require("./webpack.shared.web.js");
const devServerConfig = require("./webpack.shared.dev-server.js");

module.exports = merge(webConfig, {
  entry: "./src/app.js",
  devServer: devServerConfig,
  module: {
    rules: [
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
  plugins: [new HtmlWebpackPlugin({ template: "src/index.web.html.ejs" })],
});
