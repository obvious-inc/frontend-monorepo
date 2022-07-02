const path = require("path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const { APP_URL } = require("../build-constants.json");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

// const updateServerUrl = "https://new-shades-hazel-update-server.vercel.app";

// autoUpdater.setFeedURL({
//   url: `${updateServerUrl}/update/${process.platform}/${app.getVersion()}`,
// });

app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
});

let isQuitting = false;

app.on("before-quit", () => {
  isQuitting = true;
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: "hidden",
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "electron-main-renderer-preload.js"),
    },
  });

  app.on("activate", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  const loadApp = () => {
    mainWindow.loadURL(APP_URL).catch(() => {
      // TODO: Fail gracefully

      dialog
        .showMessageBox(mainWindow, {
          message: `Error loading app on "${APP_URL}", check your network connection and try again.`,
          cancelId: 1,
          buttons: ["Retry", "Quit"],
        })
        .then(({ response }) => {
          if (response === 1) {
            app.quit();
            return;
          }

          // Retry
          loadApp();
        });
    });
  };

  loadApp();

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
