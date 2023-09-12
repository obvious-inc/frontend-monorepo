const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args, { htmlTitle: "NOM Inbox" });
  return {
    ...config,
    entry: "./src/entry.js",
  };
};
