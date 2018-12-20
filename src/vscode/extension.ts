import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { MESSAGE_TYPES, EXTENSION_NAME, COMMANDS, CONFIG } from './constants';

class PercyEditorPanel {
  public static currentPanel: PercyEditorPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _uri: vscode.Uri;
  private _inited: boolean;
  private _webViewInited: boolean;

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this._panel = vscode.window.createWebviewPanel('percyEditor', 'Percy editor', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(extensionPath, 'dist'))
      ],
    });
    this._panel.iconPath = vscode.Uri.file(path.join(extensionPath, 'dist/favicon.png'));
    this._panel.webview.html = this.getHtmlForWebview(extensionPath);
  }

  public static CreateOrShow(extensionPath: string, uri: vscode.Uri, editMode: boolean, column?: vscode.ViewColumn) {

    if (PercyEditorPanel.currentPanel) {
      PercyEditorPanel.currentPanel._panel.reveal(PercyEditorPanel.currentPanel._panel.viewColumn);
    } else {
      PercyEditorPanel.currentPanel = new PercyEditorPanel(extensionPath, column || vscode.ViewColumn.One);
    }

    PercyEditorPanel.currentPanel.init(editMode, uri || vscode.window.activeTextEditor.document.uri);
  }

  init(editMode: boolean, uri: vscode.Uri) {
    this._uri = uri;
    this.setPercyEditorFocused(true);
    this.onActive(editMode);

    if (this._inited) {
      return;
    }

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState((e) => {
      this.setPercyEditorFocused(e.webviewPanel.active);
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(message => {
      if (message.type === MESSAGE_TYPES.INIT) {
        this._webViewInited = true;
        this.onActive(editMode);
      } else if (message.type === MESSAGE_TYPES.SAVE) {
        if (!message.editMode && !message.envFileMode) {
          vscode.window.showSaveDialog({ defaultUri: this._uri }).then((newFile) => {
            let newFileName = path.basename(newFile.fsPath);

            if (!new RegExp(CONFIG.FILE_NAME_REGEX).test(newFileName)) {
              vscode.window.showErrorMessage('The file name should only contain these characters: "0-9a-zA-Z-_."');
            } else {
              newFileName = normalizeFilename(newFileName);

              const newUri = vscode.Uri.file(path.join(path.dirname(newFile.fsPath), newFileName));
              fs.writeFileSync(newUri.fsPath, message.content);

              this._uri = newUri;
              PercyEditorPanel.currentPanel._panel.title = newFileName;

              this._panel.webview.postMessage({
                type: MESSAGE_TYPES.SAVED,
                newFileName
              });
            }
          });
        } else {
          const filePath = this._uri.fsPath;
          fs.writeFileSync(filePath, message.content);
          this._panel.webview.postMessage({
            type: MESSAGE_TYPES.SAVED,
            newFileName: path.basename(filePath)
          });
        }
      } else if (message.type === MESSAGE_TYPES.CLOSE) {
        this._panel.dispose();
      }
    }, null, this._disposables);

    this._inited = true;
  }

  private onActive(editMode: boolean) {
    const filePath = this._uri.fsPath;

    PercyEditorPanel.currentPanel._panel.title = path.basename(filePath);

    if (!this._webViewInited) {
      return;
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const envFileName = getEnvFileName();
    const dir = path.dirname(filePath);

    const message: any = {
      type: MESSAGE_TYPES.ACTIVATE,
      editMode,
      appName: vscode.workspace.asRelativePath(dir),
      fileName: path.basename(filePath),
      percyConfig: {
        ...config,
        filenameRegex: CONFIG.FILE_NAME_REGEX,
        propertyNameRegex: CONFIG.PROPERTY_NAME_REGEX
      },
    };

    message.envFileMode = message.fileName === envFileName;

    if (editMode) {
      message.fileContent = fs.readFileSync(filePath, 'utf8');
    }

    const envFilePath = path.resolve(dir, envFileName);
    if (fs.existsSync(envFilePath)) {
      message.envFileContent = fs.readFileSync(envFilePath, 'utf8');
    }

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

  private getHtmlForWebview(extensionPath: string): string {
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

  private setPercyEditorFocused(value: boolean) {
    vscode.commands.executeCommand('setContext', 'PercyEditorFocused', value);
  }

  public dispose() {
    PercyEditorPanel.currentPanel = undefined;

    this._panel.dispose();
    this.setPercyEditorFocused(false);

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public saveConfig() {
    this._panel.webview.postMessage({
      type: MESSAGE_TYPES.SAVE
    });
  }

  public showSource() {
    vscode.workspace.openTextDocument(this._uri)
      .then(document => vscode.window.showTextDocument(document));
  }
}

function getEnvFileName(): string {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);
  return config.get(CONFIG.ENVIRONMENTS_FILE);
}

function normalizeFilename(fileName: string) {
  if (!fileName) {
    return '';
  }
  fileName = fileName.trim();
  return fileName.match(/\.[y|Y][a|A]?[m|M][l|L]$/) ? fileName : fileName + '.yaml';
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {

  // Edit file
  const editCommand = vscode.commands.registerCommand(COMMANDS.EDIT, (uri: vscode.Uri) => {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true);
  });
  context.subscriptions.push(editCommand);

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
