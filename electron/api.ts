import * as fs from 'fs';
import * as path from 'path';
import * as electron from 'electron';

import { File } from './File';

export const CHANNELS = {
  OPEN_FOLER: 'percy-open-folder',
  OPEN_REPO: 'percy-open-repo',
  SHOW_PREFERENCES: 'percy-show-perferences',
};

/**
 * Register renderer ipc events listeners.
 * @param listeners the ipc events listeners.
 */
export function registerRendererListeners(listeners) {
  electron.ipcRenderer.on(CHANNELS.OPEN_FOLER, (_event: any, folder: string) => {
    listeners.openFolder(folder);
  });

  electron.ipcRenderer.on(CHANNELS.OPEN_REPO, () => {
    listeners.openRepo();
  });

  electron.ipcRenderer.on(CHANNELS.SHOW_PREFERENCES, () => {
    listeners.showPreferences();
  });
}

/**
 * Get state file path.
 * @returns state file path
 */
function getStateFile() {
  return path.resolve((electron.app || electron.remote.app).getPath('userData'), 'state.json');
}

/**
 * Get state.
 * @returns state
 */
function getState() {

  const statFile = getStateFile();

  const result = readFile(statFile);
  if (result) {
    return JSON.parse(result);
  }

  return {};
}

/**
 * Get recent folders.
 * @returns recent folders.
 */
export function getRecentFolders() {
  return getState().recentFolders || [];
}

/**
 * Clear recent folders.
 */
export function clearRecentFolders() {
  const state = getState();
  state.recentFolders = [];
  fs.writeFileSync(getStateFile(), JSON.stringify(state));
}

/**
 * Add recent folder.
 * @param folderPath the folder path to add
 */
function addRecentFolder(folderPath: string) {
  const state = getState();
  state.recentFolders = state.recentFolders || [];
  const idx = state.recentFolders.indexOf(folderPath);
  if (idx >= 0) {
    state.recentFolders.splice(idx, 1);
  }
  state.recentFolders.unshift(folderPath);
  state.recentFolders = state.recentFolders.slice(0, 10);
  fs.writeFileSync(getStateFile(), JSON.stringify(state));
}

/**
 * Get current browser window.
 * @param win The passed in browser window
 * @returns current browser window
 */
function getBrowserWindow(win?: Electron.BrowserWindow) {
  return win || electron.remote.getCurrentWindow();
}

/**
 * Open folder.
 * @param folerPath The folder path
 * @param win The browser window
 */
export function openFolder(folerPath: string, win?: Electron.BrowserWindow) {
  win = getBrowserWindow(win);

  if (!fs.existsSync(folerPath)) {
    (electron.dialog || electron.remote.dialog).showErrorBox('Folder not found', `Folder ${folerPath} does not exist`);
    return;
  }
  addRecentFolder(folerPath);
  win.webContents.send(CHANNELS.OPEN_FOLER, folerPath);
  win['setupMenu']();
}

/**
 * Open folder dialog.
 * @param win The browser window
 */
export function openFolderDialog(win?: Electron.BrowserWindow) {
  win = getBrowserWindow(win);

  (electron.dialog || electron.remote.dialog).showOpenDialog({ properties: ['openDirectory'] }, (result) => {
    if (result && result[0]) {
      openFolder(result[0], win);
    }
  });
}

/**
 * Open repo.
 * @param win The browser window
 */
export function openRepo(win?: Electron.BrowserWindow) {
  win = getBrowserWindow(win);
  win.webContents.send(CHANNELS.OPEN_REPO);
}

/**
 * Get preferences file.
 * @returns the preferences file path
 */
function getPreferencesFile() {
  return path.resolve((electron.app || electron.remote.app).getPath('userData'), 'preferences.json');
}

/**
 * Get preferences.
 * @returns preferences
 */
export function getPreferences() {
  const prefFile = getPreferencesFile();

  const result = readFile(prefFile);
  if (result) {
    return JSON.parse(result);
  }

  // Return default settings.
  return {
    environmentsFile: 'environments.yaml',
    variablePrefix: '_{',
    variableSuffix: '}_',
  };
}

/**
 * Show preferences.
 * @param win The browser window
 */
export function showPreferences(win?: Electron.BrowserWindow) {
  win = getBrowserWindow(win);
  win.webContents.send(CHANNELS.SHOW_PREFERENCES);
}

/**
 * Save preferences.
 * @param prefs The preferences to save
 */
export function savePreferences(prefs) {
  const prefFile = getPreferencesFile();
  fs.writeFileSync(prefFile, JSON.stringify(prefs));
}

/**
 * Get app's specific percy config.
 * @param file The file to get its specific percy config
 */
export function getAppPercyConfig(file: File) {
  let appPercyConfig = {};
  let parent = file.parent;
  while (parent) {
    const rcpath = path.resolve(parent.path, '.percyrc');

    const result = readFile(rcpath);
    if (result) {
      const config = JSON.parse(result);
      Object.keys(appPercyConfig).forEach(key => {
        config[key] = appPercyConfig[key];
      });
      appPercyConfig = config;
    }
    parent = parent.parent;
  }
  return appPercyConfig;
}

/**
 * Read folder.
 * @param folderPath The folder path
 * @param parent The parent
 */
export function readFolder(folderPath: string, parent?: File) {
  const folder = new File(path.normalize(folderPath), false);
  folder.fileName = path.basename(folder.path);
  folder.applicationName = parent ? parent.applicationName + '/' + folder.fileName : folder.fileName;

  const files = fs.readdirSync(folder.path);
  files.forEach(fileName => {
    const filePath = path.resolve(folder.path, fileName);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && fileName !== '.git' && fileName !== '.vscode' && fileName !== 'node_modules') {
      // ignore some well-know folders
      folder.addChild(readFolder(filePath, folder));
    } else if (stat.isFile()) {
      const ext = path.extname(fileName).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        const file = new File(filePath, true);
        file.ino = stat.ino;
        file.fileName = fileName;
        file.applicationName = folder.applicationName;
        folder.addChild(file);
      }
    }
  });

  return folder;
}

/**
 * Read file.
 * @param filePath The file path to read
 * @returns file content
 */
export function readFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return null;
}

/**
 * Save file.
 * @param filePath The file path to save
 * @param fileContent The file content to save
 */
export function saveFile(filePath: string, fileContent: string) {
  fs.writeFileSync(filePath, fileContent);
  return fs.statSync(filePath).ino;
}

/**
 * Remove file.
 * @param filePath The file path to remove
 */
export function removeFile(filePath: string) {
  fs.unlinkSync(filePath);
}
