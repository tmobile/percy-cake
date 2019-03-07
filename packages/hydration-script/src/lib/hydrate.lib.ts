/**
 *    Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

/**
 * Hydrate library module
 */
import * as fs from "fs-extra";
import * as path from "path";
import * as winston from "winston";
import { getLogger, utils } from "./common";
import { IPercyConfig } from "./interfaces";

/**
 * The hydrate methods.
 */
export class Hydrate {

    public errors: any = {};
    // the options
    private readonly options: any = {};
    private readonly logger: winston.Logger;
    private readonly colorConsole?: boolean = undefined;

    /**
     * the constructor.
     * @param options the options.
     */
    constructor(options: any, colorConsole?: boolean) {
        this.options = options;
        this.colorConsole = colorConsole;
        this.logger = getLogger(colorConsole);
    }

    /**
     * Process all apps inside given root path and writes results to output folder
     * @param appsRootFolderPath app root folder
     * @param outputFolder output folder
     */
    public async hydrateAllApps(
        appsRootFolderPath: string,
        outputFolder: string,
    ): Promise<boolean> {
        try {
            const percyConfig = await this.loadPercyConfig(appsRootFolderPath);
            const appFolders = await utils.findSubFolders(appsRootFolderPath);
            let isAnyFailed = false;
            await Promise.all(appFolders.map(async (folder) => {
                const appFolder = path.join(appsRootFolderPath, folder);
                const appOutputFolder = path.join(outputFolder, folder);
                const isPassed = await this.hydrateApp(appFolder, percyConfig, appOutputFolder);
                if (!isAnyFailed && !isPassed) {
                    isAnyFailed = true;
                }
            }));
            if (!isAnyFailed) {
                this.logger.info(`Successfully processed all apps in ${appsRootFolderPath}`);
            }
            return !isAnyFailed;
        } catch (e) {
            this.logger.error(e);
            return false;
        }
    }

    /**
     * Process all YAML configuration files and write results to output folder
     * @param appFolderPath root folder of the app
     * @param percyConfig percy configuration (optional)
     * @param outputFolder output folder
     */
    public async hydrateApp(
        appFolderPath: string,
        percyConfig: IPercyConfig | undefined,
        outputFolder: string,
    ): Promise<boolean> {
        try {
            // If percy config is not provided look for it in directory
            if (!percyConfig) {
                percyConfig = await this.loadPercyConfig(appFolderPath, true);
            } else {
                // Apply local percy config to the provided config
                percyConfig = Object.assign(
                    {},
                    percyConfig,
                    await this.loadPercyConfig(appFolderPath, false, false),
                );
            }

            const environments = await utils.loadEnvironmentsFile(appFolderPath, this.options, this.colorConsole);
            const yamlFiles = await utils.findYamlFiles(appFolderPath);

            let isAnyFailed = false;

            for (const filepath of yamlFiles) {
                const isPassed = await this.hydrateFile(filepath, environments, percyConfig, outputFolder);
                if (!isAnyFailed && !isPassed) {
                    isAnyFailed = true;
                }
            }
            if (!isAnyFailed) {
                this.logger.info(`Successfully processed all yaml config files in ${appFolderPath}`);
            }
            return !isAnyFailed;
        } catch (e) {
            this.logger.error(e);
            return false;
        }
    }

    /**
     * Process YAML configuration file and write result to output folder
     * @param yamlFilePath Input file path
     * @param environments environment list (optional, by default it uses environment file inside yaml file's folder)
     * @param percyConfig percy configuration (optional,
     * by default it merges default percy config with app's percy config and root percy config and uses it)
     * @param outputFolder output folder
     */
    public async hydrateFile(
        yamlFilePath: string,
        environments: string[] | undefined,
        percyConfig: IPercyConfig | undefined,
        outputFolder: string,
    ): Promise<boolean> {
        try {
            const directoryPath = path.dirname(yamlFilePath);
            if (!environments) {
                environments = await utils.loadEnvironmentsFile(directoryPath, this.options, this.colorConsole);
            }
            if (!percyConfig) {
                percyConfig = await this.loadPercyConfig(directoryPath, true);
            }
            const result = await utils.readAppConfigYAML(yamlFilePath, environments, percyConfig);
            await utils.writeJson(result, yamlFilePath, outputFolder);
            this.logger.info(`Successfully processed ${yamlFilePath}`);
            return true;
        } catch (e) {
            this.logger.error(`Error occurred while processing ${yamlFilePath}. `, e);
            return false;
        }
    }

    /**
     * Create percy configuration file
     * @param percyConfigFolderPath Path of folder that contains percy configuration file
     * @param hasParent traverse parent folder for percy configuration file if it's true (default: false)
     * @param loadDefaultConfig apply default percy configuration to result if it's true (default:false)
     * @param configOptions the config options.
     */
    private async loadPercyConfig(
        percyConfigFolderPath: string,
        hasParent: boolean = false,
        loadDefaultConfig: boolean = true,
    ): Promise<IPercyConfig> {
        let defaultPercyConfig;
        let parentFolderPercyConfig;
        let currentFolderPercyConfig;
        const percyConfigFileName: string = this.options.PERCY_CONFIG_FILE_NAME;
        const currentFolderConfigPath = path.join(percyConfigFolderPath, percyConfigFileName);

        if (loadDefaultConfig) {
            defaultPercyConfig = this.options.DEFAULT_PERCY_CONFIG as IPercyConfig;
        }
        // Read the percy config inside current folder if it exist
        if (await fs.pathExists(currentFolderConfigPath)) {
            currentFolderPercyConfig = await fs.readJson(currentFolderConfigPath);
        }
        if (hasParent) {
            const parentFolderConfigPath = path.join(percyConfigFolderPath, "..", percyConfigFileName);
            // Read the percy config inside parent folder if it exist
            if (await fs.pathExists(parentFolderConfigPath)) {
                parentFolderPercyConfig = await fs.readJson(parentFolderConfigPath);
            }
        }
        return Object.assign(
            {},
            defaultPercyConfig,
            parentFolderPercyConfig,
            currentFolderPercyConfig,
        ) as IPercyConfig;

    }
}
