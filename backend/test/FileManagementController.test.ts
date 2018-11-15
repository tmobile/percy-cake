/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines tests for FileManagementController.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as path from 'path';

import { assert } from 'chai';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Hapi from 'hapi';
import * as jsYaml from 'js-yaml';
import * as simpleGit from 'simple-git/promise';
import * as TypeMoq from 'typemoq';

import { start } from '../src/server';
import * as helper from '../src/utils/helper';

import MockGit from './MockGit';

const sampleJson = fs.readJsonSync(path.resolve(__dirname, '../../test/sample.json'));
const sample2Json = fs.readJsonSync(path.resolve(__dirname, '../../test/sample2.json'));

const sampleYaml = fs.readFileSync(path.resolve(__dirname, '../../test/sample.yaml')).toString();
const sample2Yaml = fs.readFileSync(path.resolve(__dirname, '../../test/sample2.yaml')).toString();

describe('FileManagementController Tests', () => {
  let server: Hapi.Server;
  let cloneError = false;
  let pushError = false;

  before(async () => {
    server = await start();
  });

  after(async () => {
    await server.stop();
    fs.removeSync(config.reposFolder);
    fs.removeSync(config.metaFolder);
  });

  beforeEach(() => {
    MockGit.reset();
    cloneError = false;
    pushError = false;
    fs.emptyDirSync(config.reposFolder);
    fs.emptyDirSync(config.metaFolder);
  });

  /**
   * Access repo.
   * @returns request payload, repo path, repo name and response result
   */
  async function accessRepo() {
    const payload = {
      repoURL: 'https://bitbucket.org/testuser/testrepo',
      username: 'test@gmail.com',
      password: '123456',
      branchName: config.branchName,
    };

    const repoName = helper.getRepoName(new URL(payload.repoURL));
    const repoPath = helper.getRepoPath({
      ...payload,
      repoName,
    });
    const repoMetadataFile = helper.getMetadataPath({
      ...payload,
      repoName,
    });

    // Mock the push behavior
    MockGit.setup((x) => x.push(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
      if (pushError) {
        return Promise.reject(new Error('Mock push error'));
      }
      return Promise.resolve(null);
    });

    // Mock the clone behavior by init a local repo
    MockGit
      .setup((x) => x.clone(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(async () => {
        fs.ensureDirSync(repoPath);
        fs.outputFileSync(`${repoPath}/readme.md`, 'Test repo');

        fs.ensureDirSync(`${repoPath}/${config.yamlAppsFolder}`);
        fs.outputFileSync(`${repoPath}/${config.yamlAppsFolder}/readme.md`, 'Test apps');

        fs.ensureDirSync(`${repoPath}/${config.yamlAppsFolder}/app1`);
        fs.ensureDirSync(`${repoPath}/${config.yamlAppsFolder}/app1/.vscode`);
        fs.outputFileSync(`${repoPath}/${config.yamlAppsFolder}/app1/readme.md`, 'Test app1');
        fs.outputFileSync(`${repoPath}/${config.yamlAppsFolder}/app1/${config.environmentsFile}`,
          'default:\n  - dev\n  - prod');
        fs.copyFileSync(path.resolve(__dirname, '../../test/sample.yaml'),
          `${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`);

        fs.ensureDirSync(`${repoPath}/${config.yamlAppsFolder}/app2`);
        fs.ensureDirSync(`${repoPath}/${config.yamlAppsFolder}/app2/.vscode`);
        fs.outputFileSync(`${repoPath}/${config.yamlAppsFolder}/app2/readme.md`, 'Test app2');
        fs.outputFileSync(`${repoPath}/${config.yamlAppsFolder}/app2/${config.environmentsFile}`,
          'default:\n  - dev\n  - prod');
        fs.copyFileSync(path.resolve(__dirname, '../../test/sample.yaml'),
          `${repoPath}/${config.yamlAppsFolder}/app2/sample.yaml`);

        const git = simpleGit(repoPath);
        await git.init(false);
        await git.add('.');
        await git.commit('Test init', undefined, { '--author': `"${payload.username} <${payload.username}>"` });
        await git.branch([config.branchName]);
        await git.checkout(config.branchName);

        if (cloneError) {
          return Promise.reject(new Error('Mock clone error'));
        }
        return Promise.resolve('');
      });

    // These methods are locally and delegate to the real git command
    MockGit.setup((x) => x.log(TypeMoq.It.isAny())).returns((arg) => simpleGit(repoPath).log(arg));
    MockGit.setup((x) => x.checkout(TypeMoq.It.isAny())).returns((arg) => simpleGit(repoPath).checkout(arg));
    // This is a local only repo which has no upstream, so discard '@{u}'
    MockGit.setup((x) => x.reset(['--hard', '@{u}'])).returns(async () => {
      const sg = simpleGit(repoPath);
      const log = await sg.log();
      return log.total > 1 ? sg.reset(['--hard', 'HEAD^']) : sg.reset(['--hard']);
    });
    MockGit.setup((x) => x.add(TypeMoq.It.isAny())).returns((arg) => simpleGit(repoPath).add(arg));
    MockGit.setup((x) => x.commit(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns((message, files, options) => simpleGit(repoPath).commit(message, files, options));

    const res = await server.inject({
      method: 'POST',
      url: `/api/${config.apiVersion}/accessRepo`,
      payload,
    });

    let result;
    if (!cloneError) {
      assert.equal(res.statusCode, 200);
      result = JSON.parse(res.payload);
      assert.isNotEmpty(result.token);
      assert.isNotEmpty(result.validUntil);
      assert.equal(result.repoName, repoName);
    }

    return { repoPath, repoName: encodeURIComponent(repoName), repoMetadataFile, payload, accessResult: result };
  }

  describe('GET /repos/{repoName}/branches/{branchName}/applications', () => {

    it('List app names in repo should success', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.equal(result.length, 2);
      assert.equal(result[0], 'app1');
      assert.equal(result[1], 'app2');
    });

    it('List app names, repo name mismatch, 400 error expected', async () => {
      const { payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/applications`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('List app names, branch name mismatch, 400 error expected', async () => {
      const { repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/applications`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });
  });

  describe('GET /repos/{repoName}/branches/{branchName}/applications/{appName}/environments', () => {

    it('Get app environments should success', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/environments`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.equal(result.length, 2);
      assert.equal(result[0], 'dev');
      assert.equal(result[1], 'prod');
    });

    it('Get app environments, repo name mismatch, 400 error expected', async () => {
      const { payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/applications/app1/environments`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('Get app environments, branch name mismatch, 400 error expected', async () => {
      const { repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/applications/app1/environments`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });

    it('Get app environments, app folder does not exist, empty result expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/NoSuchApp/environments`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.deepEqual(result, []);
    });

    it('Get app environments, environments file does not exist, empty result expected', async () => {
      const { repoPath, repoName, payload, accessResult } = await accessRepo();

      fs.removeSync(`${repoPath}/${config.yamlAppsFolder}/app1/${config.environmentsFile}`);

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/environments`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.deepEqual(result, []);
    });
  });

  describe('GET /repos/{repoName}/branches/{branchName}/files', () => {

    it('List yaml files in repo apps folder should success', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/files`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.equal(result.length, 4);
      assert.equal(result[0].fileName, 'environments.yaml');
      assert.equal(result[0].applicationName, 'app1');
      assert.isTrue(result[0].timestamp > 0);
      assert.equal(result[1].fileName, 'environments.yaml');
      assert.equal(result[1].applicationName, 'app2');
      assert.isTrue(result[1].timestamp > 0);
      assert.equal(result[2].fileName, 'sample.yaml');
      assert.equal(result[2].applicationName, 'app1');
      assert.isTrue(result[2].timestamp > 0);
      assert.equal(result[3].fileName, 'sample.yaml');
      assert.equal(result[3].applicationName, 'app2');
      assert.isTrue(result[3].timestamp > 0);
    });

    it('List yaml files, repo name mismatch, 400 error expected', async () => {
      const { payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/files`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('List yaml files, branch name mismatch, 400 error expected', async () => {
      const { repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/files`,
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });
  });

  describe('GET /repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}', () => {

    it('Get yaml file should success', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.deepEqual(result, sampleJson);
    });

    it('Get yaml file, repo name mismatch, 400 error expected', async () => {
      const { payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('Get yaml file, branch name mismatch, 400 error expected', async () => {
      const { repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });

    it('Get yaml file, app folder does not exist, 404 error expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/NoSuchApp/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 404);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'App \'NoSuchApp\' does not exist');
    });

    it('Get yaml file, file does not exist, 404 error expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/NoSuchFile.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 404);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'File \'app1/NoSuchFile.yaml\' does not exist');
    });

  });

  describe('DELETE /repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}', () => {

    it('Delete yaml file should success', async () => {
      const { repoPath, repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 204);
      assert.isTrue(!fs.existsSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`));
    });

    it('Delete yaml file, push fails, should revert to last commit', async () => {
      pushError = true;
      const { repoPath, repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 500);
      assert.isTrue(fs.existsSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`));
    });

    it('Delete yaml file, environments file can not be deleted, 400 error expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/${config.environmentsFile}`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Environments file can not be deleted');
    });

    it('Delete yaml file, repo name mismatch, 400 error expected', async () => {
      const { payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('Delete yaml file, branch name mismatch, 400 error expected', async () => {
      const { repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/applications/app1/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });

    it('Delete yaml file, app folder does not exist, 404 error expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/NoSuchApp/files/sample.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 404);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'App \'NoSuchApp\' does not exist');
    });

    it('Delete yaml file, file does not exist, 404 error expected', async () => {
      const { repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/applications/app1/files/NoSuchFile.yaml`, // tslint:disable-line
        headers: {
          authorization: accessResult.token,
        },
      });

      assert.equal(res.statusCode, 404);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'File \'app1/NoSuchFile.yaml\' does not exist');
    });

  });

  describe('POST /repos/{repoName}/branches/{branchName}/commit', () => {

    const requestPayload = (repoPath) => ({
      message: 'Test create yaml file',
      files : [
        {
          // app1/sample.yaml will be updated with content as sample2Json
          fileName: 'sample.yaml',
          fileContent: sample2Json,
          applicationName: 'app1',
          timestamp: fs.statSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`).mtimeMs,
        },
        {
          // a new sample2.yaml will be created in app2
          fileName: 'sample2.yaml',
          fileContent: sample2Json,
          applicationName: 'app2',
        },
      ],
    });

    it('Commit yaml files should success', async () => {
      const { repoPath, repoName, payload, accessResult } = await accessRepo();
      const commitPayload = requestPayload(repoPath);

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/commit`,
        headers: {
          authorization: accessResult.token,
        },
        payload: commitPayload,
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.equal(result.length, commitPayload.files.length);
      assert.equal(result[0].fileName, commitPayload.files[0].fileName);
      assert.equal(result[1].fileName, commitPayload.files[1].fileName);
      assert.equal(result[0].applicationName, commitPayload.files[0].applicationName);
      assert.equal(result[1].applicationName, commitPayload.files[1].applicationName);
      assert.exists(result[0].timestamp);
      assert.exists(result[1].timestamp);
      assert.exists(result[0].size);
      assert.exists(result[1].size);

      assert.deepEqual(
        jsYaml.safeLoad(fs.readFileSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`).toString()),
        jsYaml.safeLoad(sample2Yaml));
      assert.deepEqual(
        jsYaml.safeLoad(fs.readFileSync(`${repoPath}/${config.yamlAppsFolder}/app2/sample2.yaml`).toString()),
        jsYaml.safeLoad(sample2Yaml));
    });

    it('Commit yaml files, push fails, should revert to last commit', async () => {
      pushError = true;
      const { repoPath, repoName, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/commit`,
        headers: {
          authorization: accessResult.token,
        },
        payload: requestPayload(repoPath),
      });

      assert.equal(res.statusCode, 500);
      assert.deepEqual(
        jsYaml.safeLoad(fs.readFileSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`).toString()),
        jsYaml.safeLoad(sampleYaml));
      assert.isTrue(!fs.existsSync(`${repoPath}/${config.yamlAppsFolder}/app2/sample2.yaml`));
    });

    it('Commit yaml files, repo name mismatch, 400 error expected', async () => {
      const { repoPath, payload, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/repos/NoSuchRepo/branches/${payload.branchName}/commit`,
        headers: {
          authorization: accessResult.token,
        },
        payload: requestPayload(repoPath),
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo name mismatch');
    });

    it('Commit yaml files, branch name mismatch, 400 error expected', async () => {
      const { repoPath, repoName, accessResult } = await accessRepo();

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/NoSuchBranch/commit`,
        headers: {
          authorization: accessResult.token,
        },
        payload: requestPayload(repoPath),
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Branch name mismatch');
    });

    it('Commit yaml files, file has been changed, 409 error expected', async () => {
      const { repoPath, repoName, payload, accessResult } = await accessRepo();

      const rp = requestPayload(repoPath);
      rp.files[0].timestamp = Date.now() + 1000;

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/repos/${repoName}/branches/${payload.branchName}/commit`,
        headers: {
          authorization: accessResult.token,
        },
        payload: rp,
      });

      assert.equal(res.statusCode, 409);
      const result = JSON.parse(res.payload);
      assert.isTrue(result.message.startsWith('The following file(s) are already changed in the repository'));
      assert.deepEqual(
        jsYaml.safeLoad(fs.readFileSync(`${repoPath}/${config.yamlAppsFolder}/app1/sample.yaml`).toString()),
        jsYaml.safeLoad(sampleYaml));
      assert.isTrue(!fs.existsSync(`${repoPath}/${config.yamlAppsFolder}/app2/sample2.yaml`));
    });

  });

  describe('POST /accessRepo', () => {

    async function sleep(time) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), time * 1000);
      });
    }

    it('Access repo should success', async () => {
      const { payload, accessResult } = await accessRepo();

      await sleep(1);

      // Access repo again
      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/accessRepo`,
        payload,
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.isNotEmpty(result.token);
      assert.isNotEmpty(result.validUntil);
      assert.notEqual(result.token, accessResult.token, 'Token should change');
      assert.notEqual(result.validUntil, accessResult.validUntil, 'Token valid time should change');
      assert.equal(result.repoName, accessResult.repoName);
      const loggedInUsersMetaFile = `${config.metaFolder}/${config.loggedInUsersMetaFile}`;
      assert.equal(fs.existsSync(loggedInUsersMetaFile), true);
      const users = fs.readJsonSync(loggedInUsersMetaFile);
      assert.equal(users.length, 1);
      assert.equal(users[0], payload.username);
    });

    it('Repo metadata does not exist, should clone again', async () => {
      const { repoMetadataFile, payload, accessResult } = await accessRepo();

      fs.removeSync(repoMetadataFile);

      await sleep(1);

      // Access repo again
      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/accessRepo`,
        payload,
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.isNotEmpty(result.token);
      assert.isNotEmpty(result.validUntil);
      assert.notEqual(result.token, accessResult.token, 'Token should change');
      assert.notEqual(result.validUntil, accessResult.validUntil, 'Token valid time should change');
      assert.equal(result.repoName, accessResult.repoName);
    });

    it('Branch locked, 400 error expected', async () => {
      const payload = {
        repoURL: 'https://bitbucket.org/testuser/testrepo',
        username: 'test@gmail.com',
        password: '123456',
        branchName: config.lockedBranches[0],
      };

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/accessRepo`,
        payload,
      });

      assert.equal(res.statusCode, 400);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, `Branch '${payload.branchName}' is locked, enter another branch to work with`);
    });

    it('Repo metadata file corrupted, 401 error expected', async () => {
      const { repoMetadataFile, payload } = await accessRepo();

      fs.writeFileSync(repoMetadataFile, '{corrupted');

      // Access repo again
      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/accessRepo`,
        payload,
      });

      assert.equal(res.statusCode, 401);
      const result = JSON.parse(res.payload);
      assert.equal(result.message, 'Repo metadata file corruption');
      assert.isTrue(!fs.existsSync(repoMetadataFile));
    });

    it('Error while cloning, repo dir should be removed', async () => {
      cloneError = true;
      const { repoPath, payload } = await accessRepo();

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/accessRepo`,
        payload,
      });
      assert.equal(res.statusCode, 500);
      assert.isTrue(!fs.existsSync(repoPath));
    });
  });

});
