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
 * Script for comparing two json files and outputting their differences to stdout
 */
import * as path from "path";
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, "../config");
import * as config from "config";
import * as fs from "fs-extra";
import * as jsondiffpatch from "jsondiffpatch";
import * as commandLineArgs from "minimist";

import { getLogger, utils } from "./lib/common";
import { CompareJson } from "./lib/compare-json.lib";

// Define command line arguments
const minimistOptions = {
  alias: {
    c: "colorConsole",
    f: "files",
    o: "out",
    p: "patates"
  },
  default: { colorConsole: undefined },
  string: ["colorConsole", "files", "out", "patates"]
};

const options = commandLineArgs(process.argv.slice(2), minimistOptions);
options.files = options._;
if (options.colorConsole !== undefined) {
  options.colorConsole = options.colorConsole === "true";
}
let colorConsole: boolean = String(config.get("COLORIZE_CONSOLE")) === "true";
if (typeof options.colorConsole === "boolean") {
  colorConsole = options.colorConsole;
}
const logger = getLogger(colorConsole);
if (!options.files || options.files.length !== 2) {
  logger.error(
    "You should provide exactly 2 file names\n" +
      "Example: npm run compare-json firstFile.json secondFile.json"
  );
} else {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch(e => {
      logger.error(e);
      process.exit(1);
    });
}

async function main() {
  const compareJson = new CompareJson({});
  const diff = await compareJson.compare(options.files[0], options.files[1]);
  if (diff) {
    const formattedDiff = jsondiffpatch.formatters.console.format(diff, null);
    if (options.out) {
      writeHTML(options.out, jsondiffpatch.formatters.html.format(diff, null));
      logger.info(`Html diff file is generated in: ${options.out}`);
    }
    logger.info(colorConsole ? formattedDiff : utils.stripColor(formattedDiff));
  } else {
    logger.info(
      `${options.files[0]} and ${options.files[1]} are exactly same.`
    );
  }
}

/**
 * Writes a html json diff result to file.
 * @param {string} file the html file.
 * @param {string} diff the diff result.
 */
function writeHTML(file: string, diff: string) {
  // read the template
  const template: string = fs.readFileSync(
    path.join(__dirname, "..", "data", "diff-template.html"),
    { encoding: "utf-8" }
  );
  const htmlContent = template.replace("$$DIFF_CONTENT$$", diff);
  fs.ensureDirSync(path.dirname(file));
  fs.writeFileSync(file, htmlContent);
}
