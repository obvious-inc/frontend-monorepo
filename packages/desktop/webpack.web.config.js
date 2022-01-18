const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webConfig = require("./webpack.shared.web.js");
const devServerConfig = require("./webpack.shared.dev-server.js");

module.exports = merge(webConfig, {
  entry: "./src/app.js",
  devServer: devServerConfig,
  plugins: [new HtmlWebpackPlugin({ template: "src/index.web.html.ejs" })],
});
