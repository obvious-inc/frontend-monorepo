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

const emotionDeps = ["@emotion/react", "@emotion/react/jsx-runtime"];

const entrypoints = [
  { file: "theme.js" },
  { file: "icons.js", dependencies: ["react", ...emotionDeps] },
  {
    file: "sidebar-layout.js",
    dependencies: ["@shades/common/react", "react", ...emotionDeps],
  },
  {
    file: "dialog.js",
    dependencies: ["react", "react-aria", ...emotionDeps],
  },
  {
    file: "button.js",
    dependencies: ["react", "react-aria", ...emotionDeps],
  },
  { file: "icon-button.js", dependencies: ["react", ...emotionDeps] },
  { file: "avatar.js", dependencies: ["react", ...emotionDeps] },
];

export default [
  ...entrypoints.map(createConfig),
  createConfig({
    file: "index.js",
    dependencies: [...new Set(entrypoints.flatMap((e) => e.dependencies))],
  }),
];
