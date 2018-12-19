import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { MESSAGE_TYPES, EXTENSION_NAME, COMMANDS, CONFIG } from './constants';

class PercyEditorPanel {
  private static currentPanel: PercyEditorPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentEditor: vscode.TextEditor;
  private _uri: vscode.Uri;
  private _editMode: boolean;
  private _envFileMode: boolean;
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
        const filePath = this._editMode ? this.getFilePath() : `${this.getFilePath()}/${message.fileName}`;
        fs.writeFileSync(filePath, message.content);
        this._panel.webview.postMessage({
          type: MESSAGE_TYPES.SAVED
        });
      } else if (message.type === MESSAGE_TYPES.CLOSE) {
        this._panel.dispose();
      }
    });
  }

  public static CreateOrShow(extensionPath: string, uri: vscode.Uri, editMode: boolean, envFileMode: boolean, column?: vscode.ViewColumn) {

    if (PercyEditorPanel.currentPanel) {
      PercyEditorPanel.currentPanel._panel.reveal(PercyEditorPanel.currentPanel._panel.viewColumn);
    } else {
      PercyEditorPanel.currentPanel = new PercyEditorPanel(extensionPath, column || vscode.ViewColumn.One);
    }

    PercyEditorPanel.currentPanel._currentEditor = vscode.window.activeTextEditor;
    PercyEditorPanel.currentPanel._uri = uri;
    PercyEditorPanel.currentPanel._editMode = editMode;
    PercyEditorPanel.currentPanel._envFileMode = envFileMode;
    PercyEditorPanel.currentPanel.onActive();
  }

  private getFilePath() {
    if (this._uri) {
      return this._uri.fsPath;
    }
    return this._currentEditor.document.uri.fsPath;
  }

  private onActive() {
    if (!this._inited) {
      return;
    }

    const filePath = this.getFilePath();
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);

    const message: any = {
      type: MESSAGE_TYPES.ACTIVATE,
      editMode: this._editMode,
      percyConfig: { ...config },
    };

    const envFileName: string = config.get(CONFIG.ENVIRONMENTS_FILE);
    let dir;
    if (this._editMode) {
      dir = path.dirname(filePath);
      message.fileName = path.basename(filePath);
      message.envFileMode = message.fileName === envFileName;
      message.fileContent = fs.readFileSync(filePath, 'utf8');
    } else {
      dir = filePath;
      message.fileName = this._envFileMode ? envFileName : null;
      message.envFileMode = this._envFileMode;
    }

    message.appName = vscode.workspace.asRelativePath(dir);

    const envFilePath = path.resolve(dir, envFileName);
    if (fs.existsSync(envFilePath)) {
      message.envFileContent = fs.readFileSync(envFilePath, 'utf8');
    }

    message.files = [];
    fs.readdirSync(dir).forEach(file => {
      if (fs.statSync(path.resolve(dir, file)).isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
          message.files.push({
            applicationName: message.appName,
            fileName: file
          });
        }
      }
    });

    message.appPercyConfig = {};
    try {
      const roots = vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
      let percyrcdir = dir;
      while (true) {
        const rcpath = path.resolve(percyrcdir, '.percyrc');
        if (fs.existsSync(rcpath)) {
          Object.assign(message.appPercyConfig, JSON.parse(fs.readFileSync(rcpath, 'utf8')));
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

  public dispose(): void {
    PercyEditorPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {

  const editCommand = vscode.commands.registerCommand(COMMANDS.EDIT, (uri: vscode.Uri) => {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true, false);
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

    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, true, false, column);
  });

  context.subscriptions.push(editSideCommand);

  const newCommand = vscode.commands.registerCommand(COMMANDS.NEW, (uri: vscode.Uri) => {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, false, false);
  });

  context.subscriptions.push(newCommand);

  const newEnvCommand = vscode.commands.registerCommand(COMMANDS.NEW_ENV, (uri: vscode.Uri) => {
    PercyEditorPanel.CreateOrShow(context.extensionPath, uri, false, true);
  });

  context.subscriptions.push(newEnvCommand);
}
