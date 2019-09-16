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

import "jest";

import * as config from "config";
import * as fs from "fs-extra";
import * as path from "path";
import * as rimraf from "rimraf";
import { utils } from "../src/lib/common/index";
import { Hydrate } from "../src/lib/hydrate.lib";

const outputFolder = path.join(__dirname, "data/out/dist");
const inputFolder = path.join(__dirname, "data/apps");

const hydrate = new Hydrate(
  {
    DEFAULT_PERCY_CONFIG: config.get("DEFAULT_PERCY_CONFIG"),
    ENVIRONMENT_FILE_NAME: config.get("ENVIRONMENT_FILE_NAME"),
    LOG_LEVEL: config.get("LOG_LEVEL"),
    PERCY_CONFIG_FILE_NAME: config.get("PERCY_CONFIG_FILE_NAME"),
  },
  true
);

describe("hydrate", () => {
  describe("hydrateFile", () => {
    afterEach(() => {
      rimraf.sync(outputFolder);
    });
    test("Success", async () => {
      const inputFile = path.join(inputFolder, "shop/app.config.yaml");
      const outputFile = path.join(outputFolder, "/shop");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).resolves.toBeUndefined();
      const envs = ["dev", "local", "prod", "qat"];
      await expect(utils.findSubFolders(outputFile)).resolves.toEqual(envs);
      for (const env of envs) {
        // Compare results to expected results
        const outputJson = path.join(outputFile, env, "app.config.json");
        await expect(fs.pathExists(outputJson));
        const json = await fs.readJson(outputJson);
        const expectedJsonPath = path.join(
          __dirname,
          "data/expectedResults",
          env,
          "app.config.json"
        );
        const expectedJson = await fs.readJson(expectedJsonPath);
        expect(json).toEqual(expectedJson);
      }
    });
    test("YAML with anchors and aliases", async () => {
      const inputFile = path.join(inputFolder, "shop/app.config.yaml");
      const outputFile = path.join(outputFolder, "/shop");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).resolves.toBeUndefined();
      const envs = ["dev", "local", "prod", "qat"];
      await expect(utils.findSubFolders(outputFile)).resolves.toEqual(envs);
      for (const env of envs) {
        // Compare results to expected results
        const outputJson = path.join(outputFile, env, "app.config.json");
        await expect(fs.pathExists(outputJson));
        const json = await fs.readJson(outputJson);
        const expectedJsonPath = path.join(
          __dirname,
          "data/expectedResults",
          env,
          "app.config.json"
        );
        const expectedJson = await fs.readJson(expectedJsonPath);
        expect(json).toEqual(expectedJson);
      }
    });

    test("No default block", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithInvalidConfig/no.default.yaml"
      );
      const outputFile = path.join(outputFolder, "/appWithInvalidConfig");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject({
        message: `Invalid config file format (${inputFile})`
      });
    });

    test("No environments block", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithInvalidConfig/no.environments.yaml"
      );
      const outputFile = path.join(outputFolder, "/appWithInvalidConfig");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject({
        message: `Invalid config file format (${inputFile})`
      });
    });

    test("Env Contains New Property", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithNewPropertyInEnvNode/app.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithNewPropertyInEnvNode"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject({
        message:
          `Error in process file: ${inputFile}. Cause:\n` +
          `Cannot find property: envNewProperty in env node: qat.`
      });
    });

    test("Env Contains inconsistent type Property", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithNewPropertyInEnvNode/type-test.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithNewPropertyInEnvNode"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject({
        message:
          `Error in process file: ${inputFile}. Cause:\n` +
          `Type is different from default node for property: server.host in env node: qat.`
      });
    });

    test("Unresolvable variable", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithInvalidConfig/invalid.variables.yaml"
      );
      const outputFile = path.join(outputFolder, "/appWithInvalidConfig");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject({
        message: `Cannot resolve variables at (${inputFile} env:prod)`
      });
    });

    test("Cyclic Inherits", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithCyclicInherits/app.config.yaml"
      );
      const outputFile = path.join(outputFolder, "/appWithCyclicInherits");
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject(/Cyclic env inherits detected/);
    });

    test("Token Cyclic Reference", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithTokenCyclicReference/app.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithTokenCyclicReference"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject(/Cyclic variable reference detected/);
    });

    test("Token Cyclic Self Reference", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithTokenCyclicReference/self-reference.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithTokenCyclicReference"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).rejects.toMatchObject(/Loop variable reference/);
    });

    test("With VariableNamePrefix key", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithVariableNamePrefixKey/app.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithVariableNamePrefixKey"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).resolves.toBeUndefined();
      const envs = ["dev", "local", "prod", "qat"];
      await expect(utils.findSubFolders(outputFile)).resolves.toEqual(envs);
      for (const env of envs) {
        // Compare results to expected results
        const outputJson = path.join(outputFile, env, "app.config.json");
        await expect(fs.pathExists(outputJson));
        const json = await fs.readJson(outputJson);
        const expectedJsonPath = path.join(
          __dirname,
          "data/expectedResults",
          env,
          "app.config.json"
        );
        const expectedJson = await fs.readJson(expectedJsonPath);
        expect(json).toEqual(expectedJson);
      }
    });

    test("With Env to Ignore", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithEnvToIgnore/app.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithEnvToIgnore"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).resolves.toBeUndefined();
      const envs = ["dev", "local", "prod", "qat"];
      await expect(utils.findSubFolders(outputFile)).resolves.toEqual(envs);
      for (const env of envs) {
        // Compare results to expected results
        const outputJson = path.join(outputFile, env, "app.config.json");
        await expect(fs.pathExists(outputJson));
        const json = await fs.readJson(outputJson);
        const expectedJsonPath = path.join(
          __dirname,
          "data/expectedResults",
          env,
          "app.config.json"
        );
        const expectedJson = await fs.readJson(expectedJsonPath);
        expect(json).toEqual(expectedJson);
      }
    });

    test("Config with array", async () => {
      const inputFile = path.join(
        __dirname,
        "data/appWithTokenCyclicReference/array.config.yaml"
      );
      const outputFile = path.join(
        outputFolder,
        "/appWithTokenCyclicReference"
      );
      await expect(
        hydrate.hydrateFile(inputFile, undefined, undefined, outputFile)
      ).resolves.toBeUndefined();
      const envs = ["dev", "local", "prod", "qat"];
      await expect(utils.findSubFolders(outputFile)).resolves.toEqual(envs);
    });
  });

  describe("hydrateApp", () => {
    afterEach(() => {
      rimraf.sync(outputFolder);
    });
    test("Success", async () => {
      const inputFile = path.join(inputFolder, "/shop");
      const outputFile = path.join(outputFolder, "/shop");
      await expect(
        hydrate.hydrateApp(inputFile, undefined, outputFile)
      ).resolves.toBeUndefined();
    });
    test("No environments file", async () => {
      const inputFile = path.join(__dirname, "data/appWithoutEnvironments");
      const outputFile = path.join(outputFolder, "/appWithoutEnvironments");
      const envFileName: string = config.get("ENVIRONMENT_FILE_NAME");
      const envFilePath = path.join(inputFile, envFileName);
      await expect(
        hydrate.hydrateApp(inputFile, undefined, outputFile)
      ).rejects.toMatchObject({
        message: `Environment file '${envFilePath}' doesn't exist`
      });
    });
  });

  describe("hydrateAllApps", () => {
    beforeAll(() => {
      jest.setTimeout(200000);
    });
    afterEach(() => {
      rimraf.sync(outputFolder);
    });
    test("Invalid input folder", async () => {
      await expect(
        hydrate.hydrateAllApps("wrong-input", outputFolder)
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          "ENOENT: no such file or directory, scandir"
        )
      });
    });
    test("Success", async () => {
      await expect(
        hydrate.hydrateAllApps(inputFolder, outputFolder)
      ).resolves.toBeUndefined();
    });
  });
});
