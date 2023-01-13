import swc from "rollup-plugin-swc";

const plugins = [
  swc({
    rollup: {
      exclude: /node_modules/,
      extensions: [".js"],
    },
  }),
];

const createConfig = ({ file, dependencies = [] }) => ({
  input: `src/${file}`,
  output: {
    file: `dist/${file}`,
    format: "esm",
  },
  external: dependencies,
  plugins,
});

const entrypoints = [
  { file: "app.js", dependencies: ["react", "reselect"] },
  { file: "utils.js" },
  {
    file: "waku.js",
    dependencies: [
      "ethers",
      "@waku/core",
      "@waku/create",
      "@waku/byte-utils",
      "@waku/interfaces",
      "@noble/ed25519",
    ],
  },
  { file: "react.js", dependencies: ["react"] },
  { file: "nouns.js", dependencies: ["ethers", "@nouns/assets", "@nouns/sdk"] },
  { file: "emoji.js" },
];

export default [
  ...entrypoints.map(createConfig),
  createConfig({
    file: "index.js",
    dependencies: [...new Set(entrypoints.flatMap((e) => e.dependencies))],
  }),
];
