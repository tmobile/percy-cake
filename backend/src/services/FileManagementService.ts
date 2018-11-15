/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the file management service.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as path from 'path';

import * as boom from 'boom';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Joi from 'joi';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import * as ms from 'ms';
import * as simpleGit from 'simple-git/promise';
import { URL } from 'url';
import * as yamlJS from 'yaml-js';

import Cache from '../utils/cache';

import * as helper from '../utils/helper';
import * as Yaml from '../utils/yaml';
import GitWrapper from './GitWrapper';

// Joi schema for branch path params
const branchPathSchema = Joi.object().keys({
  repoName: Joi.string().required(),
  branchName: Joi.string().required(),
}).required();

// Joi schema for app path params
const appPathSchema = branchPathSchema.keys({
  appName: Joi.string().required(),
}).required();

// Joi schema for file path params
const filePathSchema = appPathSchema.keys({
  fileName: Joi.string().regex(/\.[y|Y][a|A]?[m|M][l|L]$/)
    .error(boom.badRequest('only YAML files are supported')).required(),
}).required();

// Joi schema for credentials
const credentialsSchema = Joi.object().keys({
  repoURL: Joi.string().uri().required(),
  username: Joi.string().required(),
  password: Joi.string().required(),
  repoName: Joi.string().required(),
  branchName: Joi.string().required(),
}).required();

/**
 * Create repo url with username and password.
 * @param metadata Metadata contains repo url, username and password.
 * @returns Repo url
 * @private
 */
const createRepoURL = (metadata) => {
  const url = new URL(metadata.repoURL);
  url.username = metadata.username;
  url.password = helper.decrypt(metadata.password);
  return url;
};

/**
 * Clone remote repo and obtain request access token.
 * @param requestBody The request body
 * @param requestInfo The request info
 * @returns access token
 */
async function accessRepo(requestBody, requestInfo) {
  if (_.includes(config.lockedBranches, requestBody.branchName)) {
    throw boom.badRequest(`Branch '${requestBody.branchName}' is locked, enter another branch to work with`);
  }

  const repoMetadata = {
    ...requestBody,
    // Encrypt password
    password: helper.encrypt(requestBody.password),
    // Remove '.git' from the end of repo url
    repoURL: requestBody.repoURL.replace(/\.git$/, ''),
  };

  // Extract the repoName from the repoURL
  const url = createRepoURL(repoMetadata);
  repoMetadata.repoName = helper.getRepoName(url);

  const repoPath = helper.getRepoPath(repoMetadata);
  const repoMetadataFile = helper.getMetadataPath(repoMetadata);

  let needClone = true;
  if (fs.existsSync(repoPath)) {
    if (!fs.existsSync(repoMetadataFile)) {
      // Repo folder exists but metadata missing, will clone again
      helper.logger.info(`${repoPath} exists but metadata missing, will clone again`);
      fs.removeSync(repoPath);
    } else {
      // Check with stored repo metadata to verify user having access to the repo
      helper.checkRepoAccess(repoMetadata, repoMetadataFile,
        ['repoURL', 'username', 'repoName', 'branchName']);

      // Will pull the update if the repo already exists
      needClone = false;
    }
  }

  try {
    if (needClone) {
      // Shallow clone repo with --depth as 1
      try {
        await GitWrapper.Git().clone(url.href, repoPath, ['-b', repoMetadata.branchName, '--depth', 1]);
        helper.logger.info(`Cloned repo: ${repoPath}`);
      } catch (err) {
        // If error while clone remove the repo dir
        fs.removeSync(repoPath);
        throw err;
      }
    } else {
      // Reset the branch and pull the update
      const git = GitWrapper.Git(repoPath);
      await git.reset(['--hard', '@{u}']);
      await git.pull(url.href);
      helper.logger.info(`Pulled repo: ${repoPath}`);
    }
  } catch (err) {
    throw helper.convertGitError(err);
  }

  let users = Cache.get('users');
  users = _.union(users, [repoMetadata.username]);
  Cache.set('users', users);
  const loggedInUsersMetaFile = `${config.metaFolder}/${config.loggedInUsersMetaFile}`;
  fs.outputJsonSync(loggedInUsersMetaFile, users);

  // Create token payload
  const tokenPayload: any = {
    username: repoMetadata.username,
    repoName: repoMetadata.repoName,
    branchName: repoMetadata.branchName,
    iat: Math.floor(Date.now() / 1000),
    userAgent: requestInfo.userAgent,
    ip: requestInfo.ip,
  };
  tokenPayload.exp = tokenPayload.iat + Math.floor(ms(config.jwtExpiresIn) / 1000);

  // Sign token and set to repo metadata
  repoMetadata.token = jwt.sign(tokenPayload, config.jwtSecret);
  repoMetadata.tokenValidUntil = new Date(tokenPayload.exp * 1000);

  // Save repo metadata locally
  fs.outputJsonSync(repoMetadataFile, repoMetadata);

  return {
    token: repoMetadata.token,
    repoName: repoMetadata.repoName,
    validUntil: repoMetadata.tokenValidUntil,
    envFileName: config.environmentsFile,
  };
}

// The schema for the accessRepo method.
accessRepo['schema'] = {
  requestBody: Joi.object().keys({
    repoURL: Joi.string().uri().required(),
    branchName: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
  }).required(),
  requestInfo: Joi.object().keys({
    userAgent: Joi.string().required(),
    ip: Joi.string().ip().required(),
  }),
};

/**
 * Push to repo.
 * @param repoPath The local repo path
 * @param credentials The credentials to use
 * @param commit The commit action hooker
 * @private
 */
const pushToRepo = async (repoPath: string, credentials: any, commit: (git: simpleGit.SimpleGit) => Promise<void>) => {
  // Go to repo
  const git = GitWrapper.Git(repoPath);

  try {
    const url = createRepoURL(credentials);

    // first pull all the changes
    await git.reset(['--hard', '@{u}']);
    await git.pull(url.href);

    // Do commit
    await commit(git);

    // Push
    await git.push(url.href);
  } catch (err) {
    // In case push error, rollback
    await git.reset(['--hard', '@{u}']);

    throw helper.convertGitError(err);
  }
};

/**
 * Check path params against credentials.
 * @param credentials The request credentials
 * @param params The path params
 * @returns repo path
 * @private
 */
const checkPathParams = (credentials, params) => {
  if (credentials.repoName !== params.repoName) {
    throw boom.badRequest('Repo name mismatch');
  }
  if (credentials.branchName !== params.branchName) {
    throw boom.badRequest('Branch name mismatch');
  }

  return helper.getRepoPath(credentials);
};

/**
 * Check file exists.
 * @param repoPath The repo path
 * @param params The path params
 * @returns repo file path and full file path
 * @private
 */
const checkFileExists = (repoPath, params) => {

  const appPath = `${config.yamlAppsFolder}/${params.appName}`;

  if (!fs.existsSync(`${repoPath}/${appPath}`)) {
    throw boom.notFound(`App '${params.appName}' does not exist`);
  }

  const repoFilePath = `${appPath}/${encodeURIComponent(params.fileName)}`;
  const fullFilePath = `${repoPath}/${repoFilePath}`;

  if (!fs.existsSync(fullFilePath)) {
    throw boom.notFound(`File '${params.appName}/${params.fileName}' does not exist`);
  }

  return {repoFilePath, fullFilePath};
};

/**
 * Commits the files to remote origin.
 * @param credentials Request credentials
 * @param params Request parameters
 * @param requestBody Request body
 * @param fileExists Flag indicates to check file existence
 * @return files with updated timestamp and size
 */
async function commitFiles(credentials, params, requestBody) {
  const repoPath = checkPathParams(credentials, params);

  // Push to repo
  await pushToRepo(repoPath, credentials, async (git: simpleGit.SimpleGit) => {

    // Do optimistic check
    const conflictFiles = [];
    for (const file of requestBody.files) {
      const applicationName = file.applicationName;
      const appPath = `${config.yamlAppsFolder}/${applicationName}`;
      const fileName = file.fileName;

      file.folderPath = `${repoPath}/${appPath}`;
      file.repoFilePath = `${appPath}/${encodeURIComponent(fileName)}`;
      file.fullFilePath = `${repoPath}/${file.repoFilePath}`;

      if (file.timestamp && fs.existsSync(file.fullFilePath)) {
        const stat = fs.statSync(file.fullFilePath);
        if (file.timestamp !== stat.mtimeMs) {
          conflictFiles.push({
            fileName,
            applicationName,
            timestamp: stat.mtimeMs,
            size: stat.size,
            config: Yaml.convertYamlToJson(fs.readFileSync(file.fullFilePath).toString()),
          });
        }
      }
    }
    if (conflictFiles.length) {
      const names = conflictFiles.map((file) => `• ${file.applicationName}/${file.fileName}`).join('\n');
      const error = boom.conflict(`The following file(s) are already changed in the repository:\n${names}`);
      error.output.payload['conflictFiles'] = conflictFiles;
      throw error;
    }

    // Commit
    for (const file of requestBody.files) {
      fs.ensureDirSync(file.folderPath);

      // Convert json to yaml
      fs.outputFileSync(file.fullFilePath, Yaml.convertJsonToYaml(file.fileContent));

      // Add file to index
      await git.add(file.repoFilePath);
    }

    // Commit
    await git.commit(
      requestBody.message, undefined,
      { '--author': `"${credentials.username} <${credentials.username}>"` });
  });

  return requestBody.files.map((file) => {
    const stat = fs.statSync(file.fullFilePath);
    return {
      fileName: file.fileName,
      applicationName: file.applicationName,
      timestamp: stat.mtimeMs,
      size: stat.size,
    };
  });
}
// The schema for the commitFiles method.
commitFiles['schema'] = {
  credentials: credentialsSchema,
  params: branchPathSchema,
  requestBody: Joi.object().keys({
    files: Joi.array().min(1).items(Joi.object().keys({
      fileName: Joi.string().required(),
      fileContent: Joi.alternatives().try(Joi.object(), Joi.array()).required(),
      applicationName: Joi.string().required(),
      timestamp: Joi.number().optional(),
    })).required(),
    message: Joi.string().required(),
  }).required(),
};

/**
 * Delete the file within the given location from local and remote repos.
 * @param credentials Request credentials
 * @param params Request parameters
 */
async function deleteFile(credentials, params) {
  const repoPath = checkPathParams(credentials, params);
  if (params.fileName === config.environmentsFile) {
    throw boom.badRequest('Environments file can not be deleted');
  }

  // Push to repo
  await pushToRepo(repoPath, credentials, async (git: simpleGit.SimpleGit) => {

    const {repoFilePath, fullFilePath} = checkFileExists(repoPath, params);

    // Make sure file in index
    await git.add(repoFilePath);

    // Delete file and commit
    fs.removeSync(fullFilePath);
    await git.commit(
      `Delete ${repoFilePath}`, repoFilePath,
      { '--author': `"${credentials.username} <${credentials.username}>"` });
  });
}
// The schema for the deleteFile method.
deleteFile['schema'] = {
  credentials: credentialsSchema,
  params: filePathSchema,
};

/**
 * Get the content of the file within the given location.
 * @param credentials Request credentials
 * @param params Request parameters
 */
async function getFile(credentials, params) {
  const repoPath = checkPathParams(credentials, params);
  const {fullFilePath} = checkFileExists(repoPath, params);

  // Convert yaml to json
  return Yaml.convertYamlToJson(fs.readFileSync(fullFilePath).toString());
}
// The schema for the getFile method.
getFile['schema'] = {
  credentials: credentialsSchema,
  params: filePathSchema,
};

/**
 * List the yaml files in the repo.
 * @param credentials Request credentials
 * @param params Request parameters
 * @returns yaml files in the repo
 */
function listFiles(credentials, params) {
  const repoPath = checkPathParams(credentials, params);

  const found = [];
  const appsPath = path.resolve(repoPath, config.yamlAppsFolder);
  fs.readdirSync(appsPath).forEach((applicationName) => {
    const appPath = path.resolve(appsPath, applicationName);
    if (!fs.statSync(appPath).isDirectory()) {
      return;
    }
    fs.readdirSync(appPath).forEach((appFile) => {
      const stat = fs.statSync(path.resolve(appPath, appFile));
      if (!stat.isFile()) {
        return;
      }
      const ext = path.extname(appFile).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        found.push({
          applicationName,
          fileName: appFile,
          timestamp: stat.mtimeMs,
          size: stat.size,
        });
      }
    });
  });
  return _.sortBy(found, 'fileName', 'applicationName');
}
// The schema for the listFiles method.
listFiles['schema'] = {
  credentials: credentialsSchema,
  params: branchPathSchema,
};

/**
 * List application names in the repo.
 * @param credentials Request credentials
 * @param params Request parameters
 * @returns yaml files in the repo
 */
function listApplications(credentials, params) {
  const repoPath = checkPathParams(credentials, params);

  const found = [];
  const appsPath = path.resolve(repoPath, config.yamlAppsFolder);
  fs.readdirSync(appsPath).forEach((applicationName) => {
    const appPath = path.resolve(appsPath, applicationName);
    if (fs.statSync(appPath).isDirectory()) {
      found.push(applicationName);
    }
  });
  return found;
}
// The schema for the listApplications method.
listApplications['schema'] = {
  credentials: credentialsSchema,
  params: branchPathSchema,
};

/**
 * Get environments in the repo app.
 * @param credentials Request credentials
 * @param params Request parameters
 * @returns environments in the repo app
 */
function getEnvironments(credentials, params): string[] {
  const repoPath = checkPathParams(credentials, params);
  params.fileName = config.environmentsFile;
  const fullFilePath = `${repoPath}/${config.yamlAppsFolder}/${params.appName}/${config.environmentsFile}`;

  if (!fs.existsSync(fullFilePath)) {
    helper.logger.warn(`App environments file '${fullFilePath}' does not exist`);
    return [];
  }

  const loaded = yamlJS.load(fs.readFileSync(fullFilePath).toString());
  return loaded.default;
}
// The schema for the getEnvironments method.
getEnvironments['schema'] = {
  credentials: credentialsSchema,
  params: appPathSchema,
};

const service = {
  accessRepo,
  commitFiles,
  deleteFile,
  getFile,
  listFiles,
  listApplications,
  getEnvironments,
};
helper.buildService(service, 'FileManagementService');

export default service;
