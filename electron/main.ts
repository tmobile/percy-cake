import { app, screen, dialog, Menu, BrowserWindow, Event } from 'electron';
import * as windowStateKeeper from 'electron-window-state';

import * as path from 'path';
import * as url from 'url';

let win: BrowserWindow;

/**
 * Setup application menu.
 */
function setupMenu() {
  const template: any[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [
        { role: 'close' },
        { role: 'minimize' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: 'Percy',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Create browser window.
 */
function createWindow() {
  setupMenu();

  const workAreaSize = screen.getPrimaryDisplay().workAreaSize;

  // Load the previous state with fallback to defaults
  const mainWindowState = windowStateKeeper({
    defaultWidth: workAreaSize.width,
    defaultHeight: workAreaSize.height
  });

  const delayShow = process.platform === 'win32' && mainWindowState.isMaximized;

  // Create the window using the state information
  win = new BrowserWindow({
    show: !delayShow,
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    icon: path.resolve(app.getAppPath(), 'media/appicon.512x512.png'),
    webPreferences: { nodeIntegration: false } // We don't need node integration in the webapp currently
  });

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(win);

  win.loadURL(url.format({
    pathname: path.resolve(app.getAppPath(), 'dist/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  if (delayShow) {
    win.once('ready-to-show', () => {
      win.show();
    });
  }

  win.webContents.on('will-prevent-unload', (e: Event) => {
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Confirm',
      message: 'There may be unsaved changes. Are you sure you want to quit?'
    }, function (response) {
      if (response === 0) { // Runs the following if 'Yes' is clicked
        e.preventDefault();
        win.close();
      }
    });
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});
