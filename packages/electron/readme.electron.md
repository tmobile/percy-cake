# Percy Electron App

## How Electron App Works

Electron app has two modes: open remote repo and open local folder.

The open remote repo mode has exactly same functionalites as webapp (With one difference that Electron app does not need cors-proxy server since there is no cors restrict for a desktop app).

The open local folder mode will open folder within local file system and supports multiple editors for multiple files.

## Package Electron App

```bash
npm install -g lerna
lerna bootstrap --hoist

# Build electron app
lerna run --scope=percy-electron-app --stream build:prod

# Package for MacOS
lerna run --scope=percy-electron-app --stream package:mac

# Package for Linux
lerna run --scope=percy-electron-app --stream package:linux

# Package for Windowns
lerna run --scope=percy-electron-app --stream package:win


# The app executables will be built at:
# MacOS: ./electron/release/Percy-mac.dmg
# Linux: ./electron/release/Percy-linux-x64.zip
# Windows: ./electron/release/Percy-win-x64.zip
```
