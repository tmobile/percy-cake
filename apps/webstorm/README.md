# Percy WebStorm Editor Extension

Java 1.8

Intellij Idea

## Build WebStorm Extension

```bash
# Build vscode extension
$ npm run vscode:build

# Copy file from vscode extension to webstorm extension
$ npm run webstorm:build

# Package webstorm extension
$ npm run webstorm:package

# To launch a sand-boxed instance of the IDE with the plugin (for testing)
$ npm run webstorm:launch
```

The extension will be packaged at: `build/distributions/PercyEditor-1.0-SNAPSHOT.zip`.

After build, you can install the plugin by following these steps:
1. Open WebStorm
2. open WebStorm settings
3. Go to `Plugins` > `Install plugin from disk` > Browse to the location of the plugin zip > Click `Open`.
4. Restart WebStorm.
