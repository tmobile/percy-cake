/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import * as path from "path";
import * as url from "url";

import {
  app,
  screen,
  dialog,
  Menu,
  BrowserWindow,
  Event,
  shell
} from "electron";

import * as WindowStateKeeper from "electron-window-state";

import * as api from "./api";

const isDarwin = process.platform === "darwin";
const isWin32 = process.platform === "win32";

let win: BrowserWindow; // This is the main window
let quitting = false; // Flag indicates app is quitting
let unloadAllowed = false;

/**
 * Setup application menu.
 */
function setupMenu() {
  const template: any[] = [
    {
      label: "Open",
      submenu: [
        {
          label: "Open Folder",
          click: () => {
            api.openFolderDialog(getMainWindow());
          }
        },
        {
          label: "Open Recent",
          submenu: [
            ...api.getRecentFolders().map(folder => {
              return {
                label: folder,
                click: () => {
                  api.openFolder(folder, getMainWindow());
                }
              };
            }),
            { type: "separator" },
            {
              label: "Clear Recently Opened",
              click: () => {
                api.clearRecentFolders();
                setupMenu();
              }
            }
          ]
        },
        { type: "separator" },
        {
          label: "Open Repo",
          click: () => {
            api.openRepo(getMainWindow());
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectall" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      role: "window",
      submenu: [
        { role: "close" },
        { role: "minimize" },
        { type: "separator" },
        { role: "front" }
      ]
    },
    {
      role: "help",
      submenu: [{ role: "reload" }, { role: "toggledevtools" }]
    }
  ];

  if (isDarwin) {
    template.unshift({
      label: "Percy",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Preferences",
          click: () => {
            api.showPreferences(getMainWindow());
          }
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideothers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    });
  } else {
    template.unshift({
      label: "Percy",
      submenu: [
        {
          label: "Preferences",
          click: () => {
            api.showPreferences(getMainWindow());
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Show window.
 */
function showWindow() {
  if (win) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
  }
}

/**
 * Get main window. Create if not exist.
 * @returns main window
 */
function getMainWindow() {
  if (win) {
    return win;
  }

  const workAreaSize = screen.getPrimaryDisplay().workAreaSize;

  // Load the previous state with fallback to defaults
  const mainWindowState = WindowStateKeeper({
    defaultWidth: workAreaSize.width,
    defaultHeight: workAreaSize.height
  });

  const delayShow = isWin32 && mainWindowState.isMaximized;

  // Create the window using the state information
  win = new BrowserWindow({
    show: !delayShow,
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    icon: path.resolve(app.getAppPath(), "media/appicon.512x512.png"),
    webPreferences: {
      nodeIntegration: false,
      preload: path.resolve(app.getAppPath(), "dist/preload.js")
    }
  });

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(win);

  win.loadURL(
    url.format({
      pathname: path.resolve(app.getAppPath(), "dist/index.html"),
      protocol: "file:",
      slashes: true
    })
  );
  // win.loadURL('http://localhost:4200');

  if (delayShow) {
    win.once("ready-to-show", () => {
      win.show();
    });
  }

  win.webContents.on("new-window", (e: Event, link: string) => {
    e.preventDefault();
    shell.openExternal(link);
  });

  win.webContents.on("will-prevent-unload", (e: Event) => {
    if (unloadAllowed) {
      unloadAllowed = false;
      e.preventDefault();
      return;
    }

    showWindow();

    dialog.showMessageBox(
      {
        type: "question",
        buttons: ["Yes", "No"],
        title: "Confirm",
        message: `There may be unsaved changes. Are you sure you want to ${
          quitting ? "quit" : "reload"
        }?`
      },
      function(response) {
        if (response === 0) {
          // Runs the following if 'Yes' is clicked
          e.preventDefault();
          unloadAllowed = true;
          if (quitting) {
            app.quit();
          } else {
            win.reload();
          }
        } else {
          // Prevented quit/reload
          quitting = false;
          unloadAllowed = false;
        }
      }
    );
  });

  win.on("close", event => {
    if (isDarwin) {
      if (!quitting) {
        // On mac, if it's just close window, simply hide it.
        event.preventDefault();
        win.hide();
      }
    } else {
      // On win/linux, quit app if close window
      app.quit();
    }
  });

  win.on("closed", () => {
    // Dereference the window object since it's closed
    win = null;
  });

  win["setupMenu"] = setupMenu;

  return win;
}

app.on("before-quit", () => (quitting = true));

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    showWindow();
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on("ready", () => {
    getMainWindow();
    setupMenu();
  });

  app.on("activate", () => {
    // On mac show the window.
    getMainWindow().show();
  });
}
