const webpack = require("webpack");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [{ loader: "style-loader" }, { loader: "css-loader" }],
      },
    ],
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      API_SERVER: process.env.NODE_ENV === "production" ? null : "/api",
    }),
  ],
};
