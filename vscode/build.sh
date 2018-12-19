#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd -P);

# Build
cd "$SCRIPT_DIR/.."

npm i

npm run build:vs

# Package
cd "$SCRIPT_DIR"

rm -f dist/index.html
rm -f dist/percy.conf.json

../node_modules/.bin/vsce package
