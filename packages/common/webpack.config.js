module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "index.js",
    library: { type: "commonjs" },
    clean: true,
  },
  externals: { react: "react" },
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
};
