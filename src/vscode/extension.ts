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

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this._panel = vscode.window.createWebviewPanel('percyEditor', 'Percy editor', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(extensionPath, 'dist'))
      ],
    });
    this._panel.webview.html = this.getHtmlForWebview(extensionPath);
    this._panel.iconPath = vscode.Uri.file(path.join(extensionPath, 'dist/favicon.png'));

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(message => {
      if (message.type === MESSAGE_TYPES.INIT) {
        this._inited = true;
        this.onActive();
      } else if (message.type === MESSAGE_TYPES.SAVE) {
        const filePath = this._uri.fsPath;
        fs.writeFileSync(filePath, message.content);
        this._panel.webview.postMessage({
          type: MESSAGE_TYPES.SAVED
        });
      } else if (message.type === MESSAGE_TYPES.CLOSE) {
        this._panel.dispose();
      }
    });

    this._panel.onDidChangeViewState((e) => {
      this.setPercyEditorFocused(e.webviewPanel.active);
    });

  }

  public static CreateOrShow(extensionPath: string, uri: vscode.Uri, column?: vscode.ViewColumn) {

    if (PercyEditorPanel.currentPanel) {
      PercyEditorPanel.currentPanel._panel.reveal(PercyEditorPanel.currentPanel._panel.viewColumn);
    } else {
      PercyEditorPanel.currentPanel = new PercyEditorPanel(extensionPath, column || vscode.ViewColumn.One);
    }

    PercyEditorPanel.currentPanel._uri = uri;
    if (!uri) {
      PercyEditorPanel.currentPanel._uri = vscode.window.activeTextEditor.document.uri;
    }
    PercyEditorPanel.currentPanel.setPercyEditorFocused(true);
    PercyEditorPanel.currentPanel.onActive();
  }

  private onActive() {
    const filePath = this._uri.fsPath;

    PercyEditorPanel.currentPanel._panel.title = path.basename(filePath);

    if (!this._inited) {
      return;
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const envFileName = getEnvFileName();
    const editMode = fs.existsSync(filePath);
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
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri);
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

    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, column);
  });
  context.subscriptions.push(editSideCommand);

  // Create new file
  const newCommand = vscode.commands.registerCommand(COMMANDS.NEW, (uri: vscode.Uri) => {
    if (!uri) {
      return;
    }

    vscode.window.showInputBox({
      prompt: 'Enter file name',
      placeHolder: 'file.yaml',
      validateInput: (value) => {
        if (!new RegExp(CONFIG.FILE_NAME_REGEX).test(value)) {
          return 'The file name should only contain these characters: "0-9a-zA-Z-_."';
        }

        value = normalizeFilename(value);

        let fileExists = false;
        fs.readdirSync(uri.fsPath).forEach(file => {
          if (file === value) {
            fileExists = true;
          }
        });

        if (fileExists) {
          return `${vscode.workspace.asRelativePath(`${uri.fsPath}${path.sep}${value}`)} already exists`;
        }
        return null;
      }
    }).then(fileName => {
      if (fileName) {
        PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(uri.fsPath, normalizeFilename(fileName))));
      }
    });
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
    PercyEditorPanel.CreateOrShow(context.extensionPath, vscode.Uri.file(path.join(uri.fsPath, envFileName)));
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
