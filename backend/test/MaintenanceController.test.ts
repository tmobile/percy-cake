/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */
/* tslint:disable:no-console */

/**
 * This file defines tests for MaintenanceController.
 *
 * @author TCSCODER
 * @version 1.0
 */
import { assert } from 'chai';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Hapi from 'hapi';
import * as _ from 'lodash';

import { start } from '../src/server';
import { extConfigFile } from '../src/utils/helper';

describe('MaintenanceController Tests', () => {
  let server: Hapi.Server;

  before(async () => {
    const users = ['user1', 'user2', 'user3'];
    const loggedInUsersMetaFile = `${config.metaFolder}/${config.loggedInUsersMetaFile}`;
    fs.outputJsonSync(loggedInUsersMetaFile, users);
    server = await start();
  });

  after(async () => {
    await server.stop();
    fs.removeSync(config.metaFolder);
    fs.removeSync(config.reposFolder);
  });

  afterEach(() => {
    fs.emptyDirSync(config.metaFolder);
  });

  describe('POST /log', () => {
    it('Log should success', async () => {
      const payload = {
        message: 'Test log message',
      };

      let loggedMessage;
      const oldLogFunc = console.log;
      console.log = (msg) => { loggedMessage = msg; };

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/log`,
        payload,
      });
      console.log = oldLogFunc;

      assert.equal(res.statusCode, 204);
      assert.isEmpty(res.payload);
      assert.equal(loggedMessage, payload.message);
    });

    it('Invalid payload, 400 error expected', async () => {
      const payload = {};

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/log`,
        payload,
      });

      assert.equal(400, res.statusCode);
      assert.isNotEmpty(JSON.parse(res.payload).message);
    });
  });

  describe('GET /healthcheck', () => {
    it('Healthcheck should success', async () => {

      const logs = {
        version: config.version,
        lastCommit: fs.readJsonSync(config.healthcheckFile),
      };
      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/healthcheck`,
      });

      assert.equal(res.statusCode, 200);

      const result = JSON.parse(res.payload);
      assert.deepEqual(result, logs);
    });
  });

  describe('POST /refreshConfiguration', () => {
    it('Refresh configuration should success', async () => {
      const defaultExtConfig = fs.readJsonSync(extConfigFile);
      const newExtConfig = {
        version: 'new version',
        branchName: 'new-branch',
        repositoryUrl: 'https://bitbucket.org/leviastan/new-sample-yaml-config.git',
        lockedBranches: ['dev', 'test', 'prod'],
      };

      server.route({
        method: 'GET',
        path: '/config/ext-config.json',
        handler: () => {
          return JSON.stringify(newExtConfig);
        },
      });

      const payload = {
        configURL: `http://localhost:${config.port}/config/ext-config.json`,
      };

      try {
        const res = await server.inject({
          method: 'POST',
          url: `/api/${config.apiVersion}/refreshConfiguration`,
          payload,
        });

        assert.equal(res.statusCode, 204);
        assert.isEmpty(res.payload);

        // Verify the runtime config is updated
        assert.equal(config.version, newExtConfig.version);
        assert.equal(config.branchName, newExtConfig.branchName);
        assert.equal(config.repositoryUrl, newExtConfig.repositoryUrl);
        assert.deepEqual(config.lockedBranches, newExtConfig.lockedBranches);

        // Verify the ext-config file is updated
        assert.deepEqual(fs.readJsonSync(extConfigFile), newExtConfig);
      } finally {
        // Restore ext-config file
        _.assign(config, defaultExtConfig);
        fs.outputJsonSync(extConfigFile, defaultExtConfig, { spaces: 2 });
      }
    });

    it('External configuration is invalid, 400 error expected', async () => {
      const invalidExtConfig = {
        version: 'new version',
        branchName: 'new-branch',
        repositoryUrl: 'https://bitbucket.org/leviastan/new-sample-yaml-config.git',
        lockedBranches: 'Not an array',
      };
      server.route({
        method: 'GET',
        path: '/config/invalid-ext-config.json',
        handler: () => {
          return JSON.stringify(invalidExtConfig);
        },
      });

      const payload = {
        configURL: `http://localhost:${config.port}/config/invalid-ext-config.json`,
      };

      const res = await server.inject({
        method: 'POST',
        url: `/api/${config.apiVersion}/refreshConfiguration`,
        payload,
      });

      assert.equal(res.statusCode, 400);
      assert.isNotEmpty(JSON.parse(res.payload).message);
    });
  });

  describe('GET /userTypeAhead', () => {
    it('get userTypeAhead should success', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/userTypeAhead`,
      });

      assert.equal(res.statusCode, 200);

      const result = JSON.parse(res.payload);
      assert.equal(result.length, 3);
      assert.equal(result[0], 'user1');
    });

    it('get userTypeAhead should success with correct filter', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/userTypeAhead?prefix=3`,
      });

      assert.equal(res.statusCode, 200);

      const result = JSON.parse(res.payload);
      assert.equal(result.length, 1);
      assert.equal(result[0], 'user3');
    });
  });

  describe('GET /defaultRepo', () => {
    it('Get default repo should success', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/${config.apiVersion}/defaultRepo`,
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.payload);
      assert.equal(result.branchName, config.branchName);
      assert.equal(result.repositoryUrl, config.repositoryUrl);
    });
  });
});
