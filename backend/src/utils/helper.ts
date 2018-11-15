/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This module contains the helper methods.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as path from 'path';
import * as util from 'util';

import * as aesjs from 'aes-js';
import axios from 'axios';
import * as boom from 'boom';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as getParams from 'get-parameter-names';
import * as Joi from 'joi';
import * as _ from 'lodash';
import * as pbkdf2 from 'pbkdf2';
import * as winston from 'winston';

const aesKey = pbkdf2.pbkdf2Sync(config.encryptKey, config.encryptSalt, 1, 32);

// Export external config file
export const extConfigFile = path.resolve(__dirname, '../../../config/ext-config.json');

// Export logger
export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf((info) => {
      return `${info.timestamp} [${info.level}]: ${info.message}`;
    })),
  level: config.logLevel,
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Log error details with signature.
 * @param err the error
 * @param signature the signature
 * @private
 */
export function logFullError(err: Error, signature: string) {
  if (!err['logged']) {
    logger.error(`Error happened in ${signature}: ${err.stack}`);
    err['logged'] = true;
  }
}

/**
 * Remove invalid properties from the object and hide long arrays.
 * @param obj the object
 * @returns the new object with removed properties
 * @private
 */
function sanitizeObject(obj) {
  // Array of field names that should not be logged
  const removeFields = ['password', 'token', 'jwtSecret', 'encryptKey', 'encryptSalt'];
  try {
    return JSON.parse(JSON.stringify(obj, (name, value) => {
      if (_.includes(removeFields, name) || name.startsWith('_')) {
        return '<removed>';
      }
      return value;
    }));
  } catch (e) {
    return obj;
  }
}

/**
 * Convert array with arguments to object.
 * @param params the name of parameters
 * @param arr the array with values
 * @return the combined object
 * @private
 */
function combineObject(params: string[], arr: any[]) {
  const ret = {};
  _.each(arr, (arg, i) => {
    ret[params[i]] = arg;
  });
  return ret;
}

/**
 * Check whether debug logging level enabled.
 * @returns true if debug logging level enabled; false otherwise
 * @private
 */
function isDebugEnabled() {
  return _.includes(['debug', 'silly', 'verbose'], config.logLevel);
}

/**
 * Decorate all functions of a service and log debug information if DEBUG is enabled.
 * @param service the service
 * @param serviceName the service name
 * @private
 */
function decorateWithLogging(service, serviceName: string) {
  if (isDebugEnabled()) {
    _.each(service, (method, name) => {
      const params = method.params || getParams(method);
      service[name] = async function serviceMethodWithLogging() {
        logger.debug(`ENTER ${serviceName}#${name}`);
        logger.debug('input arguments');
        const args = Array.prototype.slice.call(arguments);
        logger.debug(util.inspect(sanitizeObject(combineObject(params, args))));
        try {
          const result = await method.apply(this, arguments);
          logger.debug(`EXIT ${serviceName}#${name}`);
          logger.debug('output arguments');
          logger.debug(util.inspect(sanitizeObject(result)));
          return result;
        } catch (e) {
          logFullError(e, `${serviceName}#${name}`);
          throw e;
        }
      };
    });
  }
}

/**
 * Decorate all functions of a service and validate input values.
 * and replace input arguments with sanitized result form Joi
 * Service method must have a `schema` property with Joi schema
 * @param service the service
 * @private
 */
function decorateWithValidators(service) {
  _.each(service, (method, name) => {
    if (!method.schema) {
      return;
    }
    const params = getParams(method);
    service[name] = async function serviceMethodWithValidation() {
      const args = Array.prototype.slice.call(arguments);
      const value = combineObject(params, args);
      const normalized = await new Promise((resolve) => {
        Joi.validate(value, method.schema, { abortEarly: false }, (err, val) => {
          if (err) {
            throw boom.badRequest(err.message);
          } else {
            resolve(val);
          }
        });
      });
      const newArgs = [];
      // Joi will normalize values
      // for example string number '1' to 1
      // if schema type is number
      _.each(params, (param) => {
        newArgs.push(normalized[param]);
      });
      return await method.apply(this, newArgs);
    };
    service[name].params = params;
  });
}

/**
 * Apply logger and validation decorators.
 * @param service the service to wrap
 * @param serviceName the service name
 */
export function buildService(service, serviceName: string) {
  decorateWithValidators(service);
  decorateWithLogging(service, serviceName);
}

// The Joi schema for external schema
const extConfigSchema = {
  version: Joi.string().required(),
  branchName: Joi.string().required(),
  lockedBranches: Joi.array().items(Joi.string().required()).required(),
  repositoryUrl: Joi.string().uri().required(),
};

/**
 * Load the external configuration, and apply the new configuration to the app.
 * If given extConfigURL is null, will use locally stored external config.
 * @param extConfigURL The external config url
 */
export async function loadExtConfig(extConfigURL?: string) {

  if (extConfigURL) {
    // Load external config
    const res = await axios.get(extConfigURL);
    const newExtConfig = res.data;

    // Validate external config
    await new Promise((resolve, reject) => {
      Joi.validate(newExtConfig, extConfigSchema, { abortEarly: false }, (err, val) => {
        if (err) {
          reject(boom.badRequest(err.message));
        } else {
          resolve(val);
        }
      });
    });

    logger.info(
      `Load external config from ${extConfigURL}: ${JSON.stringify(sanitizeObject(newExtConfig))}`);

    // Merge external config
    _.assign(config, newExtConfig);

    // Save external config
    fs.outputJsonSync(extConfigFile, newExtConfig, { spaces: 2 });
  } else {
    // Load locally stored external config
    const extConfig = fs.readJsonSync(extConfigFile);

    logger.info(
      `Use locally stored external config: ${JSON.stringify(sanitizeObject(extConfig))}`);

    // Merge locally stored external config
    _.assign(config, extConfig);
  }

  logger.info(`All app config: ${JSON.stringify(sanitizeObject(config), undefined, 2)}`);
}

/**
 * Check with stored repo metadata to verify user having access to the repo.
 * @param repoMetadata The passing in repo metadata
 * @param repoMetadataFile The file with locally stored repo metadata
 * @param props The properties to verify
 * @returns stored repo metadata
 */
export function checkRepoAccess(repoMetadata, repoMetadataFile: string, props: string[]) {

    let storedRepoMetadata: any = fs.readFileSync(repoMetadataFile).toString();
    try {
      storedRepoMetadata = JSON.parse(storedRepoMetadata);
    } catch (err) {
      // Not a valid json format, repo metadata file corruption, remove it
      logger.warn(`${repoMetadataFile} file corruption, will be removed:\n${storedRepoMetadata}`);
      fs.removeSync(repoMetadataFile);
      throw boom.unauthorized('Repo metadata file corruption');
    }

    // Verify access token
    if (_.includes(props, 'token') && repoMetadata.token !== storedRepoMetadata.token) {
      throw boom.unauthorized('Access token not found');
    }

    // Verify user having access to the repo
    if (!_.isEqual(_.pick(repoMetadata, props), _.pick(storedRepoMetadata, props))) {
      throw boom.forbidden('Repo metadata mismatch, you are not allowed to access the repo');
    }

    return storedRepoMetadata;
}

/**
 * Encrypt.
 * @param text The text to encrypt
 * @returns encrypted text
 */
export function encrypt(text: string): string {
  const textBytes = aesjs.utils.utf8.toBytes(text);

  const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
  const encryptedBytes = aesCtr.encrypt(textBytes);

  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

/**
 * Decrypt.
 * @param encrypted The encrypted text
 * @returns decrypted text
 */
export function decrypt(encrypted: string): string {
  const encryptedBytes = aesjs.utils.hex.toBytes(encrypted);

  const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
  const decryptedBytes = aesCtr.decrypt(encryptedBytes);

  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

/**
 * Convert Git error.
 * @param err The Git error
 * @returns converted error
 */
export function convertGitError(err) {

  if (_.includes(err.message, 'remote: Invalid username or password')) {
    return boom.unauthorized('Invalid username or password');
  }

  if (_.includes(err.message, 'remote: Unauthorized') || _.includes(err.message, 'remote: Forbidden')) {
    return boom.forbidden('Git authorization forbidden');
  }

  if (_.includes(err.message, 'remote: Repository') && _.includes(err.message, 'not found')) {
    return boom.notFound('Repository not found');
  }

  if (_.includes(err.message, 'Could not find remote branch')) {
    return boom.notFound('Branch not found');
  }

  return err;
}

// Construct folder name by combining username, repoName and branchName
const getRepoFolder = (metadata) =>
  encodeURIComponent(`${metadata.username}!${metadata.repoName}!${metadata.branchName}`);

/**
 * Get repo name.
 * @param url The repo url
 * @returns the repo name
 */
export function getRepoName(url: URL) {
  const split = url.pathname.split('/');
  return split.filter((e) => e).join('/');
}

/**
 * Get repo folder path.
 * @param metadata The metadata contains username, repo name and branch name
 * @returns the path to repo folder
 */
export function getRepoPath(metadata) {
  return `${config.reposFolder}/${getRepoFolder(metadata)}`;
}

/**
 * Get metadata file path.
 * @param metadata The metadata contains username, repo name and branch name
 * @returns the path to metadata file
 */
export function getMetadataPath(metadata) {
  return `${config.metaFolder}/${getRepoFolder(metadata)}.meta`;
}
