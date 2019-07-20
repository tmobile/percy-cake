## Requirements

Java 1.8

## Build UI

The UI code is same as the UI code we used for vscode plugin.

Go to percy repo, refer to `packages/vscode/readme.vscode.md` to build.

Then copy `packages/vscode/dist/percy.bundle.min.js` to `src/main/resources`.

## Setup License

The plugin uses [jxbrowser](https://www.teamdev.com/jxbrowser) to render editor, you need copy your license key to `src/main/resources/license`.

## Build Plugin

```bash
# Build for mac: build/distributions/PercyEditor-mac-1.0-SNAPSHOT.zip
./gradlew assemble -Pmac

# Build for linux64: build/distributions/PercyEditor-linux64-1.0-SNAPSHOT.zip
./gradlew assemble -Plinux64

# Build for win32: build/distributions/PercyEditor-win32-1.0-SNAPSHOT.zip
./gradlew assemble -Pwin32

# Build for win64: build/distributions/PercyEditor-win64-1.0-SNAPSHOT.zip
./gradlew assemble -Pwin64

# Build for cross-platform: build/distributions/PercyEditor-cross-platform-1.0-SNAPSHOT.zip
./gradlew assemble
```

The plugin will be built at `build/distributions`

## Install Plugin Locally

1. Open the Settings dialog
2. Click “Plugins” in the leftmost column
3. Click on the gear icon
4. Click "Install Plugin from Disk"