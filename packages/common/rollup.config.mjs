import { swc } from "rollup-plugin-swc3";

const plugins = [
  swc({
    jsc: {
      parser: {
        syntax: "ecmascript",
        jsx: true,
      },
      transform: {
        react: {
          runtime: "automatic",
          importSource: "@emotion/react",
        },
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
  { file: "app.js", dependencies: ["viem", "react", "reselect", "zustand"] },
  {
    file: "wallet.js",
    dependencies: [
      "react",
      "viem",
      "viem/chains",
      "viem/accounts",
      "wagmi",
      "wagmi/chains",
    ],
  },
  { file: "utils.js" },
  {
    file: "react.js",
    dependencies: [
      "react",
      "react-aria",
      "@emotion/react",
      "@emotion/react/jsx-runtime",
    ],
  },
  { file: "nouns.js", dependencies: ["viem", "@nouns/assets", "@nouns/sdk"] },
  { file: "emoji.js" },
];

export default [
  ...entrypoints.map(createConfig),
  createConfig({
    file: "index.js",
    dependencies: [...new Set(entrypoints.flatMap((e) => e.dependencies))],
  }),
];
