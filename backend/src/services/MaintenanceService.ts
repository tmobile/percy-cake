/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the maintenance service.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Joi from 'joi';

import * as  _ from 'lodash';

import * as helper from '../utils/helper';

import Cache from '../utils/cache';

/**
 * Log the error, it will simply use console.log to log the error.
 * @param requestBody The request body
 */
function log(requestBody) {
  console.log(requestBody.message); // tslint:disable-line
}
// The schema for the log method.
log['schema'] = {
  requestBody: Joi.object().keys({
    message: Joi.string().required(),
  }).required(),
};

/**
 * Get the health check information.
 * @returns health check information
 */
async function healthcheck() {
  return {
    version: config.version,
    lastCommit: fs.readJsonSync(config.healthcheckFile),
  };
}

/**
 * Reload the configuration, and apply the new configuration to the app.
 * @param requestBody The request body
 */
async function refreshConfiguration(requestBody) {
  await helper.loadExtConfig(requestBody.configURL);
}
// The schema for the refreshConfiguration method.
refreshConfiguration['schema'] = {
  requestBody: Joi.object().keys({
    configURL: Joi.string().uri().required(),
  }).required(),
};

/**
 * gets the user type head
 * @param params the prefix param
 * @returns all user type ahead
 */
async function getUserTypeAhead(params) {
  return _.filter(Cache.get('users'), (i) => i.toUpperCase().indexOf(params.prefix.toUpperCase()) !== -1);
}

// The schema for the getFile method.
getUserTypeAhead['schema'] = {
  params: {
    prefix: Joi.string().default(''),
  },
};

/**
 * Get default repo url and branch name.
 * @returns default repo url and branch name
 */
function defaultRepo() {
  return _.pick(config, 'branchName', 'repositoryUrl');
}

const service = {
  log,
  healthcheck,
  refreshConfiguration,
  getUserTypeAhead,
  defaultRepo,
};
helper.buildService(service, 'MaintenanceService');

export default service;
