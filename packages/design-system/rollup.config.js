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
  { file: "theme.js" },
  { file: "icons.js" },
  { file: "sidebar-layout.js", dependencies: ["react", "@emotion/react"] },
  {
    file: "button.js",
    dependencies: ["react", "@emotion/react", "react-aria"],
  },
  { file: "avatar.js", dependencies: ["react", "@emotion/react"] },
];

export default [
  ...entrypoints.map(createConfig),
  createConfig({
    file: "index.js",
    dependencies: [...new Set(entrypoints.flatMap((e) => e.dependencies))],
  }),
];
