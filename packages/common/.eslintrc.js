module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  plugins: ["react"],
  rules: {
    "react/prop-types": "off",
    "react/display-name": "off",
    "react/no-unknown-property": [2, { ignore: ["css"] }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
