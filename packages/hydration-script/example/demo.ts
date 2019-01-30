import * as config from "config";
import * as path from "path";
import {CompareJson, Hydrate} from "percy-hydration";

const hydrate = new Hydrate({
    DEFAULT_PERCY_CONFIG: config.get("DEFAULT_PERCY_CONFIG"),
    ENVIRONMENT_FILE_NAME: config.get("ENVIRONMENT_FILE_NAME"),
    LOG_LEVEL: config.get("LOG_LEVEL"),
    PERCY_CONFIG_FILE_NAME: config.get("PERCY_CONFIG_FILE_NAME"),
});

const compareJson = new CompareJson({});

async function demo() {
    const testDataDir = path.join(__dirname, "../test/data");
    const inputFolder = path.join(testDataDir, "apps");

    const outputFolder = path.join(__dirname, "out");
    await hydrate.hydrateAllApps(inputFolder, outputFolder);

    // demo the compare json
    await compareJson.compare(path.join(testDataDir, ".percyrc"), path.join(testDataDir, "modified.percyrc"));
}

demo().then(() => {
    // done
});
