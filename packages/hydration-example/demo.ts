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

import * as config from "config";
import * as path from "path";
import { CompareJson, Hydrate } from "percy-hydration";

const hydrate = new Hydrate({
  DEFAULT_PERCY_CONFIG: config.get("DEFAULT_PERCY_CONFIG"),
  ENVIRONMENT_FILE_NAME: config.get("ENVIRONMENT_FILE_NAME"),
  LOG_LEVEL: config.get("LOG_LEVEL"),
  PERCY_CONFIG_FILE_NAME: config.get("PERCY_CONFIG_FILE_NAME"),
  PERCY_ENV_IGNORE_PREFIX: config.get("PERCY_ENV_IGNORE_PREFIX"),
  PERCY_ENV_IGNORE_SUFFIX: config.get("PERCY_ENV_IGNORE_SUFFIX"),
  PERCY_ENV_VARIABLE_NAME: config.get("PERCY_ENV_VARIABLE_NAME")
});

const compareJson = new CompareJson({});

async function demo() {
  const testDataDir = path.join(__dirname, "../../hydration-script/test/data");
  const inputFolder = path.join(testDataDir, "apps");

  const outputFolder = path.join(__dirname, "out");
  await hydrate.hydrateAllApps(inputFolder, outputFolder);

  // demo the compare json
  const diff = await compareJson.compare(
    path.join(testDataDir, ".percyrc"),
    path.join(testDataDir, "modified.percyrc")
  );
  console.log(diff);
}

demo().then(() => {
  // done
});
