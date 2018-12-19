import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { MESSAGE_TYPES, EXTENSION_NAME, COMMANDS, CONFIG } from './constants';

class PercyEditorPanel {
  public static currentPanel: PercyEditorPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
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
        const filePath = this._editMode ? this._uri.fsPath : `${this._uri.fsPath}/${message.fileName}`;
        fs.writeFileSync(filePath, message.content);
        if (!this._editMode) {
          this._editMode = true;
          this._uri = vscode.Uri.file(filePath);
          PercyEditorPanel.currentPanel._panel.title = path.basename(filePath);
        }
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

  public static CreateOrShow(extensionPath: string, uri: vscode.Uri, editMode: boolean, envFileMode: boolean, column?: vscode.ViewColumn) {

    if (PercyEditorPanel.currentPanel) {
      PercyEditorPanel.currentPanel._panel.reveal(PercyEditorPanel.currentPanel._panel.viewColumn);
    } else {
      PercyEditorPanel.currentPanel = new PercyEditorPanel(extensionPath, column || vscode.ViewColumn.One);
    }

    PercyEditorPanel.currentPanel._uri = uri;
    if (!uri) {
      PercyEditorPanel.currentPanel._uri = vscode.window.activeTextEditor.document.uri;
    }
    PercyEditorPanel.currentPanel._editMode = editMode;
    PercyEditorPanel.currentPanel._envFileMode = envFileMode;
    PercyEditorPanel.currentPanel.setPercyEditorFocused(true);
    PercyEditorPanel.currentPanel.onActive();
  }

  private onActive() {
    const filePath = this._uri.fsPath;

    PercyEditorPanel.currentPanel._panel.title = this._editMode ? path.basename(filePath) : 'Untitled';

    if (!this._inited) {
      return;
    }

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EXTENSION_NAME);

    const message: any = {
      type: MESSAGE_TYPES.ACTIVATE,
      editMode: this._editMode,
      percyConfig: {
        ...config,
        filenameRegex: '^[a-zA-Z0-9_.-]*$',
        propertyNameRegex: '^[a-zA-Z0-9$_.-]*$'
      },
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

  const showSourceCommand = vscode.commands.registerCommand(COMMANDS.SHOW_SOURCE, () => {
    PercyEditorPanel.currentPanel.showSource();
  });

  context.subscriptions.push(showSourceCommand);

  const saveConfigCommand = vscode.commands.registerCommand(COMMANDS.SAVE_CONFIG, () => {
    PercyEditorPanel.currentPanel.saveConfig();
  });

  context.subscriptions.push(saveConfigCommand);
}
