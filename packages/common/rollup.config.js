import swc from "rollup-plugin-swc";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "esm",
    // sourcemap: true,
  },
  external: ["react", "reselect"],
  plugins: [
    swc({
      rollup: {
        exclude: /node_modules/,
        // presets: [["@babel/preset-env", { loose: true }], "@babel/preset-react"],
        // plugins: ["babel-plugin-dev-expression"],
        extensions: [".js"],
      },
    }),
  ],
};
