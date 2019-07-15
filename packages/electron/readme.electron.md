# Percy Electron App

## How Electron App Works

Electron app has two modes: open remote repo and open local folder.

The open remote repo mode has exactly same functionalites as webapp (With one difference that Electron app does not need cors-proxy server since there is no cors restrict for a desktop app).

The open local folder mode will open folder within local file system and supports multiple editors for multiple files.

## Build Percy Electron App

```bash
$ npm install -g lerna
$ lerna bootstrap --hoist

# Build electron app
$ lerna run --scope=percy-cake-electron-app --stream build:prod
```

## Package Electron App

|    OS   |  Key    |
| ------- | ------- |
|  OSX    | `$ lerna run --scope=percy-cake-electron-app --stream package:mac`  |
|  *nix   | `$ lerna run --scope=percy-cake-electron-app --stream package:linux` |
| Windows | `$ lerna run --scope=percy-cake-electron-app --stream package:win`   |


The compiled and packaged installers will be located in `packages/electron/release/**`

|    OS     |  Package / Installer                              |
| --------- | ------------------------------------------------- |
| *MacOS*   | `./packages/electron/release/Percy-mac.dmg`       |
| *Linux*:  | `./packages/electron/release/Percy-linux-x64.zip` |
| *Windows* | `./packages/electron/release/Percy-win-x64.zip`   |

