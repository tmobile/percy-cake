# Percy Electron App

## How Electron App Works

Electron app has two modes: open remote repo and open local folder.

The open remote repo mode has same functionalites as webapp (With one difference that Electron app does not need cors-proxy server since there is no cors restrict for a desktop app).

The open local folder mode will open folder within local file system and supports multiple editors for multiple files.

The electron app actually loads the exactly same built bundle of webapp, it will detect whether running within the Electron environment to support local folder mode.

## Run Electron App

```bash
./electron/build.sh

# The app executables will be built at:
# MacOS: ./electron/release/Percy-mac.dmg
# Linux: ./electron/release/Percy-linux-x64.zip
# Windows: ./electron/release/Percy-win-x64.zip
```
