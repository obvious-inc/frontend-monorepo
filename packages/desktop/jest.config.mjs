export default {
  testMatch: ["**/?(*.)test.mjs"],
  transform: { "^.+\\.(t|j)sx?$": "@swc/jest" },
};
