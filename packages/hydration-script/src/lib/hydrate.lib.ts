/**
 * Hydrate library module
 */
import * as fs from "fs-extra";
import * as path from "path";
import {logger, utils} from "./common";
import {IPercyConfig} from "./interfaces";

/**
 * The hydrate methods.
 */
export class Hydrate {
    // the options
    private readonly options: any = {};

    /**
     * the constructor.
     * @param options the options.
     */
    constructor(options: any) {
        this.options = options;
    }

    /**
     * Process all apps inside given root path and writes results to output folder
     * @param appsRootFolderPath app root folder
     * @param outputFolder output folder
     */
    public async hydrateAllApps(
        appsRootFolderPath: string,
        outputFolder: string,
    ): Promise<void> {
        const percyConfig = await this.loadPercyConfig(appsRootFolderPath);
        const appFolders = await utils.findSubFolders(appsRootFolderPath);
        await Promise.all(appFolders.map(async (folder) => {
            const appFolder = path.join(appsRootFolderPath, folder);
            const appOutputFolder = path.join(outputFolder, folder);
            await this.hydrateApp(appFolder, percyConfig, appOutputFolder);
        }));
        logger.info(`Successfully processed all apps in ${appsRootFolderPath}`);
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
    ): Promise<void> {
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

        const environments = await utils.loadEnvironmentsFile(appFolderPath, this.options);
        const yamlFiles = await utils.findYamlFiles(appFolderPath);
        for (const filepath of yamlFiles) {
            await this.hydrateFile(filepath, environments, percyConfig, outputFolder);
        }
        logger.info(`Successfully processed all yaml config files in ${appFolderPath}`);
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
    ): Promise<void> {
        const directoryPath = path.dirname(yamlFilePath);
        if (!environments) {
            environments = await utils.loadEnvironmentsFile(directoryPath, this.options);
        }
        if (!percyConfig) {
            percyConfig = await this.loadPercyConfig(directoryPath, true);
        }
        const result = await utils.readAppConfigYAML(yamlFilePath, environments, percyConfig);
        await utils.writeJson(result, yamlFilePath, outputFolder);
        logger.info(`Successfully processed ${yamlFilePath}`);
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
