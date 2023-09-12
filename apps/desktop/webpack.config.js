const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args, { htmlTitle: "NOM" });
  return {
    ...config,
    entry: "./src/web-entry.js",
  };
};
