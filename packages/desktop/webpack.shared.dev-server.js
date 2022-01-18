const API_SERVER = process.env.API_SERVER ?? "http://localhost:5001";

module.exports = {
  proxy: {
    "/api": {
      target: API_SERVER,
      pathRewrite: { "^/api": "" },
    },
  },
};
