#!/usr/bin/env node

/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

/**
 * Script for processing YAML configuration files and converting it to environment specific JSON configuration
 */
import * as path from "path";
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, "../config");
import * as config from "config";
import * as commandLineArgs from "minimist";
import { getLogger } from "./lib/common";
import { Hydrate } from "./lib/hydrate.lib";

// Define command line arguments

const minimistOptions = {
  alias: {
    a: "app",
    c: "colorConsole",
    f: "file",
    o: "out",
    r: "root"
  },
  boolean: ["root", "app", "file"],
  default: {
    app: false,
    colorConsole: undefined,
    file: false,
    root: false
  },
  string: ["out", "colorConsole"]
};

const getNumberOfOptionsSet = (opts: string[]) => opts.filter(o => o).length;
const options = commandLineArgs(process.argv.slice(2), minimistOptions);
options.path = options._[0];

if (options.colorConsole !== undefined) {
  options.colorConsole = options.colorConsole === "true";
}
let colorConsole: boolean = String(config.get("COLORIZE_CONSOLE")) === "true";

if (typeof options.colorConsole === "boolean") {
  colorConsole = options.colorConsole;
}

const logger = getLogger(colorConsole);
if (getNumberOfOptionsSet([options.root, options.app, options.file]) !== 1) {
  logger.error("You should choose one of these options --root, --app, --file");
} else if (!options.path) {
  logger.error("--path is required");
} else if (!options.out) {
  logger.error("--out option is required");
} else {
  main()
    .then(isAllValid => {
      if (!isAllValid) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch(e => {
      logger.error(e);
      process.exit(1);
    });
}

async function main() {
  try {
    const hydrate = new Hydrate(
      {
        DEFAULT_PERCY_CONFIG: config.get("DEFAULT_PERCY_CONFIG"),
        ENVIRONMENT_FILE_NAME: config.get("ENVIRONMENT_FILE_NAME"),
        LOG_LEVEL: config.get("LOG_LEVEL"),
        PERCY_CONFIG_FILE_NAME: config.get("PERCY_CONFIG_FILE_NAME"),
        PERCY_ENV_VARIABLE_NAME: config.get("PERCY_ENV_VARIABLE_NAME")
      },
      colorConsole
    );

    options.path = path.resolve(__dirname, options.path);
    options.out = path.resolve(__dirname, options.out);

    if (options.root) {
      await hydrate.hydrateAllApps(options.path, options.out);
    } else if (options.app) {
      await hydrate.hydrateApp(options.path, undefined, options.out);
    } else if (options.file) {
      await hydrate.hydrateFile(
        options.path,
        undefined,
        undefined,
        options.out
      );
    }
    return true;
  } catch (e) {
    return false;
  }
}
