import { swc } from "rollup-plugin-swc3";

const plugins = [
  swc({
    jsc: {
      parser: {
        syntax: "ecmascript",
        jsx: true,
      },
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
  { file: "app.js", dependencies: ["react", "reselect", "zustand"] },
  {
    file: "wallet.js",
    dependencies: ["react", "wagmi", "wagmi/chains", "ethers"],
  },
  { file: "utils.js" },
  { file: "react.js", dependencies: ["react", "react-aria"] },
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
