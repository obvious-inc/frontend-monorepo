import prettier from "eslint-config-prettier";
import next from "eslint-config-next";
import nextOnPages from "eslint-plugin-next-on-pages";

export default {
  root: true,
  plugins: {
    next,
    nextOnPages,
  },
  extends: [
    next.configs["core-web-vitals"],
    nextOnPages.configs.recommended,
    prettier,
  ],
  rules: {
    "import/no-anonymous-default-export": "off",
    "jsx-a11y/alt-text": "off",
    "react/prop-types": "off",
    "react/display-name": "off",
    "react/no-unknown-property": [
      2,
      {
        ignore: ["css"],
      },
    ],
    "@next/next/no-img-element": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
