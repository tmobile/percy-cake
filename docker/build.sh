#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd -P);

# build backend
cd "$SCRIPT_DIR/../backend"

echo "installing backend packages"

npm install --silent

# Build app, the typescripts within "src" and "test" folders
# will be built into "build" folder
npm run build

# build frontend
cd "$SCRIPT_DIR/../frontend"

echo "installing frontend packages"

npm install --silent

# build angular app and put the output to public folder of backend
npm run build -- --prod --output-path=../backend/public/
