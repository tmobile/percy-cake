#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd -P);

# Build angular app
cd "$SCRIPT_DIR/.."

npm i

npm run build:prod -- --output-path=./electron/dist 

# Package electron app
cd "$SCRIPT_DIR"

npm i

../node_modules/.bin/tsc -p .

node conf.js

./node_modules/.bin/electron-builder -mwl
