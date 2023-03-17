const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("Native", {});
