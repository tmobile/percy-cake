#!/usr/bin/env node

/**
 * Script for comparing two json files and outputting their differences to stdout
 */
import * as fs from "fs";
import * as jsondiffpatch from "jsondiffpatch";
import * as commandLineArgs from "minimist";
import * as path from "path";
import {logger} from "./lib/common";
import {CompareJson} from "./lib/compare-json.lib";

// Define command line arguments
const minimistOptions = {
    alias: {
        f: "files",
        o: "out",
        p: "patates",
    },
    string: ["files", "out", "patates"],
};

const options = commandLineArgs(process.argv.slice(2), minimistOptions);
options.files = options._;
if (!options.files || options.files.length !== 2) {
    logger.error("You should provide exactly 2 file names\n" +
        "Example: npm run compare-json firstFile.json secondFile.json");
} else {
    main().catch((e) => {
        logger.error(e);
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
        logger.info(formattedDiff);
    } else {
        logger.info(`${options.files[0]} and ${options.files[1]} are exactly same.`);
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
        path.join(__dirname, "..", "data", "diff-template.html"), {encoding: "utf-8"});
    const htmlContent = template.replace("$$DIFF_CONTENT$$", diff);
    fs.writeFileSync(file, htmlContent);
}
