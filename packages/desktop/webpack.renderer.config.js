const webConfig = require("./webpack.shared.web.js");
const electronRules = require("./webpack.rules.js");

webConfig.module.rules = [...electronRules, ...webConfig.module.rules];

module.exports = webConfig;
