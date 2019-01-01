# Percy VSCode Editor Extension

## How VSCode Extension works

In general, the VSCode extension of Percy editor is also an Angular app running in [VSCode webview](https://code.visualstudio.com/docs/extensions/webview).

1. Module and Component are core concepts of angular, so we abstract the common ui part of [editor component](src/app/components/editor), making it reusable in both webapp and VSCode extension app.
2. The vscode extension app does not need some functionalities (like route, browser fs, localstorage, pages components, most ngrx effects. These functionalities may not even be supported in vscode webview). So we have done necessary code refactor to make the vscode extension app can get rid of those unneeded and only import needed dependency modules.
3. So as point 2 implied, the webapp and vscode extension app use different dependency modules, to build and bundle them separately we pass their main entrypoints as “--main” parameter to “ng build” command:

   - Webapp main entrypoint: [src/webapp/webapp.ts](src/webapp/webapp.ts) => [src/webapp/app.module.ts](src/webapp/app.module.ts)
   - VSCode main entrypoint: [src/vscode/vsapp.ts](src/vscode/vsapp.ts) => [src/vscode/vsapp.module.ts](src/vscode/vsapp.module.ts)

4. The communication between vscode extension and its webview content is done by the official way using [message post](https://code.visualstudio.com/docs/extensions/webview#_passing-messages-from-an-extension-to-a-webview).

## Run VSCode Extension

```bash
# At first build & package the vscode extenstion
./vscode/build.sh

# The extension will be packaged at ./vscode/percy-editor-extension-0.0.0.vsix
```

After build, you can either:

- Open the project in VSCode, Click "Debug -> Start Debugging", a new VSCode window will be opened with the extension activated.
- Or install the extension in VScode: `code --install-extension ./vscode/percy-editor-extension-0.0.0.vsix`
