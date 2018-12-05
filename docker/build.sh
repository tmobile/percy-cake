#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd -P);

# build frontend
cd "$SCRIPT_DIR/.."

echo "installing frontend packages"

npm install --silent

# build angular app and put the output to dist folder
npm run build:prod
