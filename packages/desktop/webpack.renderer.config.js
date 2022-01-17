const webpack = require("webpack");
const rules = require("./webpack.rules");

rules.push({
  test: /\.css$/,
  use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

module.exports = {
  module: {
    rules,
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      API_SERVER: process.env.NODE_ENV === "production" ? null : "/api",
    }),
  ],
};
