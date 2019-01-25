"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("config");
const path = require("path");
const percy_hydration_1 = require("percy-hydration");
const hydrate = new percy_hydration_1.Hydrate({
    DEFAULT_PERCY_CONFIG: config.get("DEFAULT_PERCY_CONFIG"),
    ENVIRONMENT_FILE_NAME: config.get("ENVIRONMENT_FILE_NAME"),
    LOG_LEVEL: config.get("LOG_LEVEL"),
    PERCY_CONFIG_FILE_NAME: config.get("PERCY_CONFIG_FILE_NAME"),
});
const compareJson = new percy_hydration_1.CompareJson({});
function demo() {
    return __awaiter(this, void 0, void 0, function* () {
        const testDataDir = path.join(__dirname, "../test/data");
        const inputFolder = path.join(testDataDir, "apps");
        const outputFolder = path.join(__dirname, "out");
        yield hydrate.hydrateAllApps(inputFolder, outputFolder);
        // demo the compare json
        yield compareJson.compare(path.join(testDataDir, ".percyrc"), path.join(testDataDir, "modified.percyrc"));
    });
}
demo().then(() => {
    // done
});
//# sourceMappingURL=demo.js.map