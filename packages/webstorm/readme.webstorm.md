# Percy WebStorm Editor Extension

## Build WebStorm Extension

```bash
npm install -g lerna
lerna bootstrap --hoist

# Build vscode extension
lerna run --scope=percy-vscode-extension --stream build:prod

# Copy file from vscode extension to webstorm extension
lerna run --scope=percy-webstorm-extension --stream build

# Package webstorm extension (all platforms)
lerna run --scope=percy-webstorm-extension --stream package
# The extension will be packaged at build/distributions/PercyEditor-cross-platform-1.0-SNAPSHOT.zip

# Package webstorm extension (macOS)
lerna run --scope=percy-webstorm-extension --stream package:mac
# The extension will be packaged at build/distributions/PercyEditor-mac-1.0-SNAPSHOT.zip

# Package webstorm extension (win32)
lerna run --scope=percy-webstorm-extension --stream package:win32
# The extension will be packaged at build/distributions/PercyEditor-win32-1.0-SNAPSHOT.zip

# Package webstorm extension (win64)
lerna run --scope=percy-webstorm-extension --stream package:win64
# The extension will be packaged at build/distributions/PercyEditor-win64-1.0-SNAPSHOT.zip

# Package webstorm extension (linux)
lerna run --scope=percy-webstorm-extension --stream package:linux64
# The extension will be packaged at build/distributions/PercyEditor-linux64-1.0-SNAPSHOT.zip


```

After build, you can install the plugin by:
1. Open WebStorm
2. open WebStorm settings
3. Go to `Plugins` > `Install plugin from disk` > Browse to the location of the plugin zip > Click `Open`.
4. Restart WebStorm.
