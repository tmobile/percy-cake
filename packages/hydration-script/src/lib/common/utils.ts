/**
 * Utility functions
 */
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
// @ts-ignore
import {Validator} from "jsonschema";
import * as _ from "lodash";
import * as path from "path";
import {IAppConfig, IPercyConfig} from "../interfaces";
import {logger} from "./index";

/**
 * Read and validate YAML config file
 * @param filePath the YAML file path
 * @param environments the environments
 * @param percyConfig the percy config
 */
export async function readAppConfigYAML(
    filePath: string,
    environments: string[],
    percyConfig: IPercyConfig,
): Promise<object> {
    const appConfig = await readYAML(filePath);
    const validatedAppConfig = validateAppConfig(appConfig, filePath);
    let envNodes;
    try {
        envNodes = mergeEnvNodes(validatedAppConfig, environments);
    } catch (e) {
        throw new Error(`Error in process file: ${filePath}. Cause:\n${e.message}`);
    }
    const result: object = {};
    // Resolve variables of each environment
    _.each(
        envNodes,
        (envNode, environment) => {
            try {
                _.set(result, environment, resolveVariables(envNode, percyConfig));
            } catch (e) {
                logger.error(e.message);
                throw new Error(`Cannot resolve variables at (${filePath} env:${environment})`);
            }
        },
    );
    return result;
}

/**
 * Read environment file
 * @param envFileFolderPath environment file path
 * @param configOptions the hydrate lib options.
 */
export async function loadEnvironmentsFile(envFileFolderPath: string, configOptions: any): Promise<string[]> {
    const envFileName: string = configOptions.ENVIRONMENT_FILE_NAME;
    const envFilePath = path.join(envFileFolderPath, envFileName);
    const isFileExists = await fs.pathExists(envFilePath);
    if (!isFileExists) {
        throw new Error(`Environment file '${envFilePath}' doesn't exist`);
    }
    const appConfig = await readYAML(envFilePath);
    const validatedAppConfig = validateAppConfig(appConfig, envFilePath);
    return Object.keys(validatedAppConfig.environments);
}

/**
 * Read yaml file and parse it
 * @param filepath filepath
 */
export async function readYAML(filepath: string): Promise<object> {
    const file = await fs.readFile(filepath, "utf8");
    return yaml.safeLoad(file);
}

/**
 * Resolve variable references of an object
 * @param envNode input object
 * @param percyConfig percy configuration
 */
export function resolveVariables(envNode: object, percyConfig: IPercyConfig): object {
    const tokens = resolveTokens(envNode, percyConfig);
    // substitute
    let result = substitute(envNode, tokens, percyConfig);

    // remove those starts with variableNamePrefix
    if (percyConfig.variableNamePrefix) {
        const validKeys = _.keys(result).filter((key) => !key.startsWith(percyConfig.variableNamePrefix));
        result = _.pick(result, validKeys);
    }
    return result;
}

/**
 * Tokens (which are top level properties of default config) can also be variable and reference each other.
 * This method resolves them.
 *
 * @param envNode the env node data
 * @param percyConfig the percy config
 * @returns the resolved tokens
 */
function resolveTokens(envNode: object, percyConfig: IPercyConfig): object {
    const tokens: any = {};
    _.each(envNode, (value, key) => {
        if (!_.isArray(value) && !_.isObject(value)) {
            tokens[key] = value;
        }
    });
    const result: any = _.cloneDeep(tokens);
    const referenceLinks: any[] = [];
    while (true) {
        let referenceFound = false;
        _.each(result, (value, key) => {
            if (typeof value !== "string") {
                return;
            }
            let retValue = value;
            const regExp = createRegExp(percyConfig);
            while (true) {
                const regExpResult = regExp.exec(value);
                if (!regExpResult) {
                    break;
                }
                const fullMatch = regExpResult[0];
                const tokenName = regExpResult[1];
                const tokenValue = result[tokenName];
                if (typeof tokenValue === "string") {
                    if (createRegExp(percyConfig).exec(tokenValue)) {
                        referenceFound = true;
                        addTokenReference(referenceLinks, key, tokenName);
                        continue;
                    }
                    retValue = retValue.replace(fullMatch, tokenValue);
                }
            }
            result[key] = retValue;
        });
        if (!referenceFound) {
            break;
        }
    }

    return result;
}

/**
 * Substitute the strings with token values.
 * @param {object} obj the object to be substitute.
 * @param {object} tokens the token.
 * @param {IPercyConfigInterface} percyConfig the percy config.
 * @returns {object} the substitute object.
 */
function substitute(obj: object, tokens: object, percyConfig: IPercyConfig): object {
    _.each(obj, (value, key) => {
        if (_.isArray(value)) {
            _.set(obj, key, substituteArray(value, tokens, percyConfig));
        } else if (_.isObject(value)) {
            _.set(obj, key, substitute(value, tokens, percyConfig));
        } else if (_.isString(value)) {
            _.set(obj, key, substituteString(value, tokens, percyConfig));
        }
    });
    return obj;
}

/**
 * Substitute the array with token values of array type.
 * @param {array} items the array to be substitute.
 * @param {object} tokens the token.
 * @param {IPercyConfigInterface} percyConfig the percy config.
 * @returns {object} the substitute object.
 */
function substituteArray(items: any[], tokens: object, percyConfig: IPercyConfig): any[] {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (_.isArray(item)) {
            items[i] = substituteArray(item, tokens, percyConfig);
        } else if (_.isObject(item)) {
            items[i] = substitute(item, tokens, percyConfig);
        } else if (_.isString(item)) {
            items[i] = substituteString(item, tokens, percyConfig);
        }
    }
    return items;
}

/**
 * Substitute the string with token values of array type.
 * @param {string} str the array to be substitute.
 * @param {object} tokens the token.
 * @param {IPercyConfigInterface} percyConfig the percy config.
 * @returns {object} the substitute object.
 */
function substituteString(str: string, tokens: object, percyConfig: IPercyConfig): string {
    let retValue = str;
    const regExp = createRegExp(percyConfig);
    while (true) {
        const regExpResult = regExp.exec(str);
        if (!regExpResult) {
            break;
        }
        const fullMatch = regExpResult[0];
        const tokenName = regExpResult[1];
        const tokenValue = _.get(tokens, tokenName);
        if (tokenValue) {
            retValue = retValue.replace(fullMatch, tokenValue);
        } else {
            throw new Error(`Cannot resolve variables for: ${tokenName}`);
        }
    }
    return retValue;
}
/**
 * Escape reg exp.
 *
 * @param text the text might contain reg exp to escape
 * @returns escaped text
 */
function escapeRegExp(text: string) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Create regexp for variable reference based on percy config.
 *
 * @returns regexp for variable reference
 */
function createRegExp(percyConfig: IPercyConfig) {
    const prefix = percyConfig.variablePrefix;
    const suffix = percyConfig.variableSuffix;
    const regexPattern = `${escapeRegExp(prefix)}(.+?)${escapeRegExp(suffix)}`;
    return new RegExp(regexPattern, "g");
}

/**
 * When resolve token variable references, we collect them to detect loop reference.
 * @param referenceLinks the collected reference links
 * @param refFrom the reference from (left side)
 * @param refTo the reference to (right side)
 * @throws Error if loop reference detected
 */
function addTokenReference(referenceLinks: any[], refFrom: string, refTo: string) {
    if (refFrom === refTo) {
        throw new Error("Loop variable reference: " + [refFrom, refTo].join("->"));
    }
    let added = false;
    _.each(referenceLinks, (referenceLink) => {
        if (referenceLink[referenceLink.length - 1] !== refFrom) {
            return;
        }

        const idx = referenceLink.indexOf(refTo);
        if (idx > -1) {
            const cyclic = referenceLink.slice(idx);
            cyclic.push(refTo);
            throw new Error("Cyclic variable reference detected: " + cyclic.join("->"));
        }
        referenceLink.push(refTo);
        added = true;
    });

    if (!added) {
        referenceLinks.push([refFrom, refTo]);
    }
}

/**
 * Merge environment specific data with default ones
 * @param appConfig app configuration object
 * @param environments environment list
 */
export function mergeEnvNodes(appConfig: IAppConfig, environments: string[]): object {
    const mergedEnvNodes: object = {};
    // calculate the env in inherits order
    const sortedEnv = sortEnvByInherits(environments, appConfig.environments);
    // Apply default values to each environment
    sortedEnv.forEach(
        (e) => _.set(
            mergedEnvNodes,
            e,
            // Merge default values and environment specific values
            mergeEnvNode(mergedEnvNodes, e, appConfig),
        ),
    );
    return mergedEnvNodes;
}

/**
 * Merge the properties from parents into the env node.
 *
 * @param mergedEnvNodes the merged env nodes
 * @param env the environment name
 * @param appConfig app configuration object
 */
function mergeEnvNode(mergedEnvNodes: object, env: string, appConfig: IAppConfig) {
    const parentEnvNode = getParentEnvNode(mergedEnvNodes, env, appConfig);
    const currentEnvNode = _.get(appConfig.environments, env);

    const mergedEnvNode = _.cloneDeep(parentEnvNode);

    mergeProperties(mergedEnvNode, currentEnvNode, env, "");

    return mergedEnvNode;
}

/**
 * Merge properties
 *
 * @param {object} dest the destination object
 * @param {object} src the source object
 * @param {string} env the env.
 * @param {string} propertyName the property name.
 */
function mergeProperties(dest: object, src: object, env: string, propertyName: string) {
    _.each(src, (value, key) => {
        // ignore inherits key
        if (key !== "inherits") {
            const name = propertyName ? `${propertyName}.${key}` : key;
            if (!_.has(dest, key)) {
                throw new Error(`Cannot find property: ${name} in env node: ${env}.`);
            }
            const valueInDest = _.get(dest, key);
            if (typeof valueInDest !== typeof value) {
                throw new Error(`Type is different from default node for property: ${name} in env node: ${env}.`);
            }

            if (_.isPlainObject(value) && _.isPlainObject(valueInDest)) {
                mergeProperties(valueInDest, value, env, name);
            } else {
                _.set(dest, key, value);
            }
        }
    });
}

/**
 * Gets a env's inherits's values.
 * @param {object} mergedEnvNodes the calculate env values.
 * @param {string} env the current env to calculate.
 * @param {object} appConfig the env config.
 * @returns {object} the inherited value.
 */
function getParentEnvNode(mergedEnvNodes: object, env: string, appConfig: IAppConfig): object {
    const inherits = _.get(_.get(appConfig.environments, env), "inherits");
    if (inherits) {
        return _.get(mergedEnvNodes, inherits);
    }
    // no inherits, return default node
    return appConfig.default;
}

/**
 * Sort the environments by inheritance order. No inherites comes first.
 * @param {string[]} environments the environments.
 * @param {object} envNodes the config of the env nodes.
 * @returns {string[]} the calculated order.
 */
function sortEnvByInherits(environments: string[], envNodes: object): string[] {
    const orderedEnv: string[] = [];
    for (const env of environments) {
        if (orderedEnv.indexOf(env) >= 0) {
            continue;
        }
        const stack: string[] = [];
        let current = env;
        while (true) {
            stack.push(current);
            const inherits = _.get(_.get(envNodes, current), "inherits");
            if (!inherits) {
                // leaf
                break;
            } else {
                if (stack.indexOf(inherits) >= 0) {
                    stack.push(inherits);
                    throw new Error("Cyclic env inherits detected: " + stack.join(" -> "));
                } else {
                    current = inherits;
                }
            }
        }
        for (let i = stack.length - 1; i >= 0; i--) {
            orderedEnv.push(stack[i]);
        }
    }
    return orderedEnv;
}

/**
 * Validate app configuration file
 * @param appConfig app configuration object
 * @param configFilePath config file path for logging purposes (optional)
 */
export function validateAppConfig(appConfig: object, configFilePath?: string): IAppConfig {
    const schema = {
        id: "/AppConfig",
        properties: {
            default: {
                type: "object",
            },
            environments: {
                type: "object",
            },
        },
        required: ["default", "environments"],
        type: "object",
    };
    const v = new Validator();
    const result = v.validate(appConfig, schema);
    if (!result.valid) {
        result.errors.forEach((e) => logger.error(
            e.message + `${configFilePath ? ` (${configFilePath})` : ""}`),
        );
        throw new Error(`Invalid config file format ${configFilePath ? `(${configFilePath})` : ""}`);
    }
    return appConfig as IAppConfig;
}

/**
 * Ensure environment folders exist in output folder
 * @param environments environment list
 * @param outputFolder output folder
 */
export async function ensureEnvironmentFolders(environments: string[], outputFolder: string): Promise<void> {
    for (const env of environments) {
        await fs.ensureDir(path.join(outputFolder, env));
    }
}

/**
 * Write results to output folder
 * @param envNode the resolved environment specific data
 * @param yamlFilePath file path of the input yaml file
 * @param outputFolder output folder
 */
export async function writeJson(envNode: object, yamlFilePath: string, outputFolder: string): Promise<void> {
    const environments = Object.keys(envNode);
    await ensureEnvironmentFolders(environments, outputFolder);
    const filename = path.basename(yamlFilePath, ".yaml");
    await Promise.all(
        environments.map(async (env) => {
            const outputFilepath = path.join(outputFolder, env, `${filename}.json`);
            await fs.writeJSON(outputFilepath, _.get(envNode, env), {spaces: 2});
        }),
    );
}

/**
 * List all files with .yaml extension inside given folder
 * @param folderPath folder path
 */
export async function findYamlFiles(folderPath: string): Promise<string[]> {
    const files = await fs.readdir(folderPath);
    return files
        .filter((f) => path.extname(f) === ".yaml")
        .map((f) => path.join(folderPath, f));
}

/**
 * List all sub folders inside given folder
 * @param folderPath folder path
 */
export async function findSubFolders(folderPath: string): Promise<string[]> {
    const files = await fs.readdir(folderPath);
    const folders: string[] = [];
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fs.lstat(filePath);
        if (stat.isDirectory()) {
            folders.push(file);
        }
    }
    return folders;
}
