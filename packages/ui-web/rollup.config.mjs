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
  { file: "inline-button.js", dependencies: ["react", ...emotionDeps] },
  {
    file: "input.js",
    dependencies: ["react", "@shades/common/react", ...emotionDeps],
  },
  {
    file: "popover.js",
    dependencies: [
      "react",
      ...emotionDeps,
      "@shades/common/react",
      "@react-stately/overlays",
      "react-aria",
    ],
  },
  {
    file: "dropdown-menu.js",
    dependencies: [
      "react",
      ...emotionDeps,
      "react-aria",
      "react-stately",
      "@react-stately/overlays",
      "@shades/common/react",
    ],
  },
  {
    file: "tooltip.js",
    dependencies: ["react", ...emotionDeps, "@radix-ui/react-tooltip"],
  },
  {
    file: "toolbar.js",
    dependencies: ["react", ...emotionDeps, "@radix-ui/react-toolbar"],
  },
  { file: "rich-text.js", dependencies: ["react", ...emotionDeps] },
  {
    file: "rich-text-editor.js",
    dependencies: [
      "@shades/common/utils",
      "@shades/common/app",
      "react",
      ...emotionDeps,
      "slate",
      "slate-react",
      "slate-history",
      "is-hotkey",
    ],
  },
  { file: "emoji.js", dependencies: ["react", ...emotionDeps] },
  {
    file: "emoji-picker.js",
    dependencies: [
      "react",
      ...emotionDeps,
      "@shades/common/app",
      "@shades/common/react",
      "@shades/common/utils",
      "react-aria",
      "@react-stately/overlays",
    ],
  },
  { file: "avatar.js", dependencies: ["react", ...emotionDeps] },
  {
    file: "account-avatar.js",
    dependencies: [
      "react",
      "wagmi",
      "@shades/common/app",
      "@shades/common/nouns",
      ...emotionDeps,
    ],
  },
  {
    file: "account-avatar-stack.js",
    dependencies: [
      "react",
      "wagmi",
      "@shades/common/app",
      "@shades/common/nouns",
      "@shades/common/utils",
      ...emotionDeps,
    ],
  },
  {
    file: "channel-avatar.js",
    dependencies: [
      "react",
      "wagmi",
      "@shades/common/app",
      "@shades/common/nouns",
      "@shades/common/utils",
      ...emotionDeps,
    ],
  },
  {
    file: "inline-user-button.js",
    dependencies: ["react", "@shades/common/app", ...emotionDeps],
  },
  {
    file: "inline-channel-button.js",
    dependencies: ["react", "@shades/common/app", ...emotionDeps],
  },
  {
    file: "channel-messages-scroll-view.js",
    dependencies: [
      "react",
      "@shades/common/app",
      "@shades/common/react",
      "@shades/common/nouns",
      ...emotionDeps,
    ],
  },
];

export default [
  ...entrypoints.map(createConfig),
  createConfig({
    file: "index.js",
    dependencies: [...new Set(entrypoints.flatMap((e) => e.dependencies))],
  }),
];
