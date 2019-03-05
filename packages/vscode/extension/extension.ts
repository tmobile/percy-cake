/**
 *    Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { MESSAGE_TYPES, EXTENSION_NAME, COMMANDS, CONFIG } from './constants';

/**
 * The editor panel, it contains a webview running the angular app specially bundled for vscode.
 */
class PercyEditorPanel {

  // There is only one editor panel instance
  public static currentPanel: PercyEditorPanel | undefined;

  // The webview panel
  private readonly _panel: vscode.WebviewPanel;

  // The disposables
  private readonly _disposables: vscode.Disposable[] = [];

  // The file uri
  private _uri: vscode.Uri;

  // The edit mode flag
  private _editMode: boolean;

  // The event handlers registered flag
  private _eventRegistered: boolean;

  // The webview inited flag
  private _webViewInited: boolean;

  // The file water
  private fileWatcher: vscode.FileSystemWatcher;

  // The changed file uri
  private changedFileUri: vscode.Uri;

  /**
   * Create or show the editor panel.
   * @param extensionPath the path to this extension
   * @param uri the uri of file
   * @param editMode the edit mode
   * @param column the column to show the panel
   */
  public static CreateOrShow(extensionPath: string, uri: vscode.Uri, editMode: boolean, column?: vscode.ViewColumn) {

    if (!PercyEditorPanel.currentPanel) {
      // Create if not exists
      PercyEditorPanel.currentPanel = new PercyEditorPanel(extensionPath, column || vscode.ViewColumn.One);
    }

    // Show editor panel
    PercyEditorPanel.currentPanel.show(uri || vscode.window.activeTextEditor.document.uri, editMode);
  }

  /**
   * Create a new editor panel.
   * @param extensionPath the path to this extension
   * @param column the column to show the panel
   */
  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this._panel = vscode.window.createWebviewPanel('percyEditor', 'Percy editor', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(extensionPath, 'dist'))
      ],
    });
    this._panel.iconPath = vscode.Uri.file(path.join(extensionPath, 'dist/favicon.png'));
    this._panel.webview.html = getHtmlForWebview(extensionPath);
  }

  /**
   * Show the panel.
   * @param uri the uri of file
   * @param editMode the edit mode
   */
  private show(uri: vscode.Uri, editMode: boolean) {
    this._uri = uri;
    this._editMode = editMode;

    this.registerEventHandlers();

    this._panel.reveal(this._panel.viewColumn);

    this.renderWebview();

    setPercyEditorFocused(true);
  }

  /**
   * Register event handlers.
   */
  private registerEventHandlers() {

    // Handle file change event
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    this.changedFileUri = null;
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(this._uri.fsPath, false, false, true);
    const fileChangeHandler = (uri: vscode.Uri) => {
      if (this._editMode && uri.fsPath === this._uri.fsPath) {
        if (this._panel.visible) {
          // Can only send message to visible panel
          this._panel.webview.postMessage({
            type: MESSAGE_TYPES.FILE_CHANGED,
            fileContent: fs.readFileSync(this._uri.fsPath, 'utf8')
          });
          this.changedFileUri = null;
        } else {
          this.changedFileUri = uri;
        }
      }
    };
    this.fileWatcher.onDidCreate(fileChangeHandler);
    this.fileWatcher.onDidChange(fileChangeHandler);

    if (this._eventRegistered) {
      // Following event handlers only need be registered once
      return;
    }

    // Handle panel dispose event
    this._panel.onDidDispose(() => this.dispose(), this, this._disposables);

    // Handle panel view state event
    this._panel.onDidChangeViewState((e) => {
      setPercyEditorFocused(e.webviewPanel.active);
      if (e.webviewPanel.active && this.changedFileUri && this.changedFileUri.fsPath === this._uri.fsPath) {
        this._panel.webview.postMessage({
          type: MESSAGE_TYPES.FILE_CHANGED,
          fileContent: fs.readFileSync(this._uri.fsPath, 'utf8')
        });
        this.changedFileUri = null;
      }
    }, this, this._disposables);

    // Handle message posted from webview
    this._panel.webview.onDidReceiveMessage(message => {
      if (message.type === MESSAGE_TYPES.INIT) {
        // Webview inited, render it
        this._webViewInited = true;
        this.renderWebview();
      } else if (message.type === MESSAGE_TYPES.SAVE) {
        // Hanlde save event
        if (!message.editMode && !message.envFileMode) {
          // Save a new file
          vscode.window.showSaveDialog({ defaultUri: this._uri }).then((newFile) => {
            if (!newFile) {
              this._panel.webview.postMessage({
                type: MESSAGE_TYPES.SAVE_CANCELLED,
              });
              return;
            }
            let newFileName = path.basename(newFile.fsPath);

            if (!new RegExp(CONFIG.FILE_NAME_REGEX).test(newFileName)) {
              vscode.window.showErrorMessage('The file name should only contain these characters: "0-9a-zA-Z-_."');
              this._panel.webview.postMessage({
                type: MESSAGE_TYPES.SAVE_CANCELLED,
              });
            } else {
              newFileName = normalizeFilename(newFileName);

              const newUri = vscode.Uri.file(path.join(path.dirname(newFile.fsPath), newFileName));
              fs.writeFileSync(newUri.fsPath, message.fileContent);

              this._panel.webview.postMessage({
                type: MESSAGE_TYPES.SAVED,
                fileContent: message.fileContent,
                newFileName
              });

              this._uri = newUri;
              this._editMode = true;
              PercyEditorPanel.currentPanel._panel.title = newFileName;
            }
          });
        } else {
          const filePath = this._uri.fsPath;
          fs.writeFileSync(filePath, message.fileContent);
          this._panel.webview.postMessage({
            type: MESSAGE_TYPES.SAVED,
            fileContent: message.fileContent,
            newFileName: path.basename(filePath)
          });

          this._editMode = true;
          PercyEditorPanel.currentPanel._panel.title = path.basename(filePath);
        }
      } else if (message.type === MESSAGE_TYPES.FILE_DIRTY) {
        // Hanlde file dirty event
        const filePath = this._uri.fsPath;
        const fileName = path.basename(filePath);
        PercyEditorPanel.currentPanel._panel.title = message.dirty ? '*' + fileName : fileName;
      } else if (message.type === MESSAGE_TYPES.CLOSE) {
        // Hanlde close event
        this._panel.dispose();
      }
    }, this, this._disposables);

    this._eventRegistered = true;
  }

  /**
   * Render the webview.
   */
  private renderWebview() {
    const filePath = this._uri.fsPath;
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    PercyEditorPanel.currentPanel._panel.title = !this._editMode ? '*' + fileName : fileName;

    // Only render after inited
    if (!this._webViewInited) {
      return;
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const envFileName = getEnvFileName();

    const message: any = {
      type: MESSAGE_TYPES.RENDER,
      editMode: this._editMode,
      envFileMode: fileName === envFileName,
      appName: vscode.workspace.asRelativePath(dir),
      fileName,
      pathSep: path.sep,
      percyConfig: {
        ...config,
        filenameRegex: CONFIG.FILE_NAME_REGEX,
        propertyNameRegex: CONFIG.PROPERTY_NAME_REGEX
      },
    };

    // Load file content
    if (this._editMode) {
      message.fileContent = fs.readFileSync(filePath, 'utf8');
    }

    // Load env file content
    const envFilePath = path.resolve(dir, envFileName);
    if (fs.existsSync(envFilePath)) {
      message.envFileContent = fs.readFileSync(envFilePath, 'utf8');
    }

    // Load specific percy config
    message.appPercyConfig = {};
    try {
      const roots = vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
      let percyrcdir = dir;
      while (true) {
        const rcpath = path.resolve(percyrcdir, '.percyrc');
        if (fs.existsSync(rcpath)) {
          message.appPercyConfig = Object.assign(JSON.parse(fs.readFileSync(rcpath, 'utf8')), message.appPercyConfig);
        }
        if (roots.indexOf(percyrcdir) > -1) {
          break;
        }
        const parentDir = path.resolve(percyrcdir, '..');
        if (parentDir === percyrcdir) {
          break;
        }
        percyrcdir = parentDir;
      }
    } catch (err) {
      // ignore
    }

    this._panel.webview.postMessage(message);
  }

  /**
   * Save config.
   */
  public saveConfig() {
    this._panel.webview.postMessage({
      type: MESSAGE_TYPES.SAVE
    });
  }

  /**
   * Show source.
   */
  public showSource() {
    vscode.workspace.openTextDocument(this._uri)
      .then(document => vscode.window.showTextDocument(document));
  }

  /**
   * Close this panel.
   */
  private dispose() {
    PercyEditorPanel.currentPanel = undefined;

    this._panel.dispose();
    this.fileWatcher.dispose();
    setPercyEditorFocused(false);

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

/**
 * Set whether this editor panel is focused.
 * @param value indicates whether this editor panel is focused.
 */
function setPercyEditorFocused(value: boolean) {
  vscode.commands.executeCommand('setContext', 'PercyEditorFocused', value);
}

/**
 * Get html for webview.
 * @param extensionPath the path to this extension.
 * @return html for webview
 */
function getHtmlForWebview(extensionPath: string): string {
  const scriptPathOnDisk = vscode.Uri.file(path.join(extensionPath, 'dist/percy.bundle.min.js'));
  const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' });

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>PERCY Editor</title>
        <base href="/">

        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body class="default-theme vscode-theme">
        <app-vscode-root></app-vscode-root>
        <script type="text/javascript" src="${scriptUri}"></script>
      </body>
    </html>
      `;
}

/**
 * Get env file name from config.
 * @return env file name
 */
function getEnvFileName(): string {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);
  return config.get(CONFIG.ENVIRONMENTS_FILE);
}

/**
 * Normalize file name.
 * @param fileName the file name to normalize
 * @return normalized file name
 */
function normalizeFilename(fileName: string): string {
  if (!fileName) {
    return '';
  }
  fileName = fileName.trim();
  return fileName.match(/\.[y|Y][a|A]?[m|M][l|L]$/) ? fileName : fileName + '.yaml';
}

/**
 * Edit file.
 * @param context vscode extension context
 * @param uri File uri
 * @param column The column to show
 */
function editFile(context: vscode.ExtensionContext, uri: vscode.Uri, column?: vscode.ViewColumn) {

  if (!uri) {
    if (vscode.window.activeTextEditor) {
      const ext = path.extname(vscode.window.activeTextEditor.document.uri.fsPath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.window.activeTextEditor.document.uri, true, column);
        return;
      }
    }

    const options: vscode.OpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: false,
      filters: {Yaml: ['yaml', 'yml']}
    };
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
      options.defaultUri = vscode.workspace.workspaceFolders[0].uri;
    }
    vscode.window.showOpenDialog(options).then(uris => {
      if (uris && uris.length) {
        PercyEditorPanel.CreateOrShow(context.extensionPath, uris[0], true, column);
      }
    });
  } else {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true, column);
  }
}

/**
 * Create new file.
 * @param uri Folder uri
 * @param callback The callback function
 */
function createNewFile(uri: vscode.Uri, callback: Function) {
  if (!uri) {
    const options: vscode.OpenDialogOptions = {
      canSelectFiles: false,
      canSelectFolders: true
    };
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
      options.defaultUri = vscode.workspace.workspaceFolders[0].uri;
    }
    vscode.window.showOpenDialog(options).then(uris => {
      if (uris && uris.length) {
        callback(uris[0]);
      }
    });
  } else {
    callback(uri);
  }
}

/**
 * Activate this extension. Register all the commands this extension supports.
 * @param context the extension context
 */
export function activate(context: vscode.ExtensionContext) {

  // Edit file
  const editCommand = vscode.commands.registerCommand(COMMANDS.EDIT, (uri: vscode.Uri) => {
    editFile(context, uri);
  });
  context.subscriptions.push(editCommand);

  // Edit file to side
  const editSideCommand = vscode.commands.registerCommand(COMMANDS.EDIT_SIDE, (uri: vscode.Uri) => {
    const active = vscode.window.activeTextEditor;
    let column: vscode.ViewColumn;
    if (!active) {
      column = vscode.ViewColumn.One;
    } else {
      switch (active.viewColumn) {
        case vscode.ViewColumn.One:
          column = vscode.ViewColumn.Two;
          break;
        case vscode.ViewColumn.Two:
          column = vscode.ViewColumn.Three;
          break;
        default:
          column = active.viewColumn;
      }
    }

    editFile(context, uri, column);
  });
  context.subscriptions.push(editSideCommand);

  // Create new file
  const newCommand = vscode.commands.registerCommand(COMMANDS.NEW, (uri: vscode.Uri) => {
    createNewFile(uri, (_uri: vscode.Uri) => {
      PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(_uri.fsPath, 'Untitled.yaml')), false);
    });
  });
  context.subscriptions.push(newCommand);

  // Create new env file
  const newEnvCommand = vscode.commands.registerCommand(COMMANDS.NEW_ENV, (uri: vscode.Uri) => {
    createNewFile(uri, (_uri: vscode.Uri) => {
      const envFileName = getEnvFileName();

      let envFileExists = false;
      fs.readdirSync(_uri.fsPath).forEach(file => {
        if (file === envFileName) {
          envFileExists = true;
        }
      });
      if (envFileExists) {
        vscode.window.showWarningMessage(`${vscode.workspace.asRelativePath(`${_uri.fsPath}${path.sep}${envFileName}`)} already exists`);
        return;
      }
      PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(_uri.fsPath, envFileName)), false);
    });
  });
  context.subscriptions.push(newEnvCommand);

  // Show source
  const showSourceCommand = vscode.commands.registerCommand(COMMANDS.SHOW_SOURCE, () => {
    PercyEditorPanel.currentPanel.showSource();
  });
  context.subscriptions.push(showSourceCommand);

  // Save config
  const saveConfigCommand = vscode.commands.registerCommand(COMMANDS.SAVE_CONFIG, () => {
    PercyEditorPanel.currentPanel.saveConfig();
  });
  context.subscriptions.push(saveConfigCommand);
}
