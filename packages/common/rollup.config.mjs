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
  { file: "apis.js" },
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
  {
    file: "ethereum-react/index.js",
    dependencies: ["viem", "react", "wagmi"],
  },
  {
    file: "nouns/index.js",
    dependencies: ["@nouns/assets", "@nouns/sdk"],
  },
  { file: "emoji.js" },
  { file: "custom-emoji.js" },
];

export default entrypoints.map(createConfig);
