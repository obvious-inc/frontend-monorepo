const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args);
  return {
    ...config,
    entry: "./src/entry.js",
  };
};
