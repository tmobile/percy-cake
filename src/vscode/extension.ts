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
  show(uri: vscode.Uri, editMode: boolean) {
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
            let newFileName = path.basename(newFile.fsPath);

            if (!new RegExp(CONFIG.FILE_NAME_REGEX).test(newFileName)) {
              vscode.window.showErrorMessage('The file name should only contain these characters: "0-9a-zA-Z-_."');
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
        }
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

    PercyEditorPanel.currentPanel._panel.title = fileName;

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
        percyrcdir = path.resolve(percyrcdir, '../');
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
  public dispose() {
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
 * Activate this extension. Register all the commands this extension supports.
 * @param context the extension context
 */
export function activate(context: vscode.ExtensionContext) {

  // Edit file
  const editCommand = vscode.commands.registerCommand(COMMANDS.EDIT, (uri: vscode.Uri) => {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true);
  });
  context.subscriptions.push(editCommand);

  // Edit file to side
  const editSideCommand = vscode.commands.registerCommand(COMMANDS.EDIT_SIDE, (uri: vscode.Uri) => {
    const active = vscode.window.activeTextEditor;
    let column;
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

    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true, column);
  });
  context.subscriptions.push(editSideCommand);

  // Create new file
  const newCommand = vscode.commands.registerCommand(COMMANDS.NEW, (uri: vscode.Uri) => {
    if (!uri) {
      return;
    }
    PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(uri.fsPath, 'Untitled')), false);
  });
  context.subscriptions.push(newCommand);

  // Create new env file
  const newEnvCommand = vscode.commands.registerCommand(COMMANDS.NEW_ENV, (uri: vscode.Uri) => {
    if (!uri) {
      return;
    }
    const envFileName = getEnvFileName();

    let envFileExists = false;
    fs.readdirSync(uri.fsPath).forEach(file => {
      if (file === envFileName) {
        envFileExists = true;
      }
    });
    if (envFileExists) {
      vscode.window.showWarningMessage(`${vscode.workspace.asRelativePath(`${uri.fsPath}${path.sep}${envFileName}`)} already exists`);
      return;
    }
    PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(uri.fsPath, envFileName)), false);
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
