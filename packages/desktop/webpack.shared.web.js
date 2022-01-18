const webpack = require("webpack");

module.exports = {
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
      API_SERVER: process.env.NODE_ENV === "production" ? null : "/api",
    }),
  ],
};
