/**
 * compare-json library module
 */
import * as fs from "fs-extra";
import * as jsondiffpatch from "jsondiffpatch";

/**
 * The compare json options.
 */
export class CompareJson {
    private options: any;

    /**
     * the constructor.
     * @param options the options.
     */
    constructor(options: any) {
        this.options = options;
    }
    /**
     * Read and compare two given JSON files and produce a Delta object
     * @param firstJSONFilePath JSON file path
     * @param secondJSONFilePath JSON file path
     */
    public async compare(firstJSONFilePath: string, secondJSONFilePath: string)
        : Promise<jsondiffpatch.Delta | undefined> {
        const firstJSONFile = await fs.readJson(firstJSONFilePath);
        const secondJSONFile = await fs.readJson(secondJSONFilePath);
        return jsondiffpatch.diff(firstJSONFile, secondJSONFile);
    }
}
