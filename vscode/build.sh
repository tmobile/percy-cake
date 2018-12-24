#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd -P);

# Build angular app
cd "$SCRIPT_DIR/.."

npm i

npm run build:prod -- --main=src/vscode/vsapp.ts --output-path=./vscode/dist

# Package extension
cd "$SCRIPT_DIR"

npm i

../node_modules/.bin/tsc -p .

rm -f dist/index.html
rm -f dist/percy.conf.json

./node_modules/.bin/vsce package
