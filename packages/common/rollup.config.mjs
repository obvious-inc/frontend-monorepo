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
  {
    file: "app.js",
    dependencies: [
      "@emotion/react/jsx-runtime",
      "viem",
      "react",
      "reselect",
      "zustand",
    ],
  },
  { file: "apis.js" },
  { file: "utils.js", dependencies: ["marked"] },
  {
    file: "react.js",
    dependencies: [
      "react",
      "react-aria",
      "@emotion/react",
      "@emotion/react/jsx-runtime",
    ],
  },
  {
    file: "ethereum-react/index.js",
    dependencies: ["viem", "react", "wagmi"],
  },
  {
    file: "nouns/index.js",
    dependencies: ["@lilnounsdao/assets", "@lilnounsdao/sdk"],
  },
  { file: "emoji.js" },
  { file: "custom-emoji.js" },
  { file: "empty-module.js" },
];

export default entrypoints.map(createConfig);
