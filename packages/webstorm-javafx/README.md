## Requirements

Java 1.8

Intellij Idea

## Build UI

The UI code is same as the UI code we used for vscode plugin.

Go to percy repo, refer to `packages/vscode/readme.vscode.md` to build.

Then copy `packages/vscode/dist/percy.bundle.min.js` to `src/main/resources`.

## Build Plugin

```bash
./gradlew assemble
```

The plugin will be built at `build/distributions/PercyEditor-1.0-SNAPSHOT.zip`

## Install Plugin Locally

1. Open the Settings dialog
2. Click “Plugins” in the leftmost column
3. Click on the gear icon
4. Click "Install Plugin from Disk"