/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines tests for auth security.
 *
 * @author TCSCODER
 * @version 1.0
 */
import { assert } from 'chai';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Hapi from 'hapi';
import * as jwt from 'jsonwebtoken';

import { start } from '../src/server';
import * as helper from '../src/utils/helper';

const tokenPayload: any = {
  username: 'TestUser',
  repoName: 'TestUser/test',
  branchName: 'admin',
};

/**
 * Sign JWT token.
 * @param payload The token payload
 * @param expiresIn The seconds token will expire in
 * @returns JWT token
 */
function signToken(expiresIn: number) {
  tokenPayload.iat = Math.floor(Date.now() / 1000);
  tokenPayload.exp = tokenPayload.iat + expiresIn;
  return jwt.sign(tokenPayload, config.jwtSecret);
}

describe('Auth Tests', () => {
  let server: Hapi.Server;

  before(async () => {
    server = await start();
  });

  after(async () => {
    await server.stop();
    fs.removeSync(config.reposFolder);
    fs.removeSync(config.metaFolder);
  });

  beforeEach(async () => {
    fs.removeSync(helper.getRepoPath(tokenPayload));
    fs.removeSync(helper.getMetadataPath(tokenPayload));
  });

  describe('GET /repos/{repoName}/branches/{branchName}/applications', () => {
    test('GET', `/api/${config.apiVersion}/repos/repoName/branches/admin/applications`);
  });

  describe('GET /repos/{repoName}/branches/{branchName}/applications/{appName}/environments', () => {
    test('GET', `/api/${config.apiVersion}/repos/repoName/branches/admin/applications/app1/environments`);
  });

  describe('GET /repos/{repoName}/branches/{branchName}/files', () => {
    test('GET', `/api/${config.apiVersion}/repos/repoName/branches/admin/files`);
  });

  describe('GET /repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}', () => {
    test('GET', `/api/${config.apiVersion}/repos/repoName/branches/admin/applications/app1/files/config.yaml`);
  });

  describe('DELETE /repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}', () => {
    test('DELETE', `/api/${config.apiVersion}/repos/repoName/branches/admin/applications/app1/files/config.yaml`);
  });

  describe('POST /repos/{repoName}/branches/{branchName}/commit', () => {
    test('POST', `/api/${config.apiVersion}/repos/repoName/branches/admin/commit`);
  });

  /**
   * Do tests.
   * @param method The http method
   * @param url The url
   */
  function test(method, url) {
    it('Miss access token, 401 error expected', async () => {
      const res = await server.inject({
        method,
        url,
      });

      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.payload).message, 'Miss access token');
    });

    it('Invalid access token, 401 error expected', async () => {
      const res = await server.inject({
        method,
        url,
        headers: {
          authorization: 'invalid token',
        },
      });

      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.payload).message, 'Invalid access token');
    });

    it('Expired access token, 401 error expected', async () => {
      const res = await server.inject({
        method,
        url,
        headers: {
          authorization: signToken(-1000),
        },
      });

      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.payload).message, 'Expired access token');
    });

    it('Repo metadata not found, 401 error expected', async () => {
      const res = await server.inject({
        method,
        url,
        headers: {
          authorization: signToken(1000),
        },
      });

      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.payload).message, 'Repo metadata not found');
    });

    it('Token not found in repo metadata, 401 error expected', async () => {
      const repoMetadataFile = helper.getMetadataPath(tokenPayload);
      fs.outputJsonSync(repoMetadataFile, {});

      const res = await server.inject({
        method,
        url,
        headers: {
          authorization: signToken(1000),
        },
      });

      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.payload).message, 'Access token not found');
    });

    it('Repo metadata mismatch, 403 error expected', async () => {
      const token = signToken(1000);
      const repoMetadataFile = helper.getMetadataPath(tokenPayload);
      fs.outputJsonSync(repoMetadataFile, {
        token,
      });

      const res = await server.inject({
        method,
        url,
        headers: {
          authorization: token,
        },
      });

      assert.equal(res.statusCode, 403);
      assert.equal(JSON.parse(res.payload).message, 'Repo metadata mismatch, you are not allowed to access the repo');
    });

    it('Brower/agent mismatch, 403 error expected', async () => {
      const token = signToken(1000);
      const repoMetadataFile = helper.getMetadataPath(tokenPayload);
      fs.outputJsonSync(repoMetadataFile, {
        token,
        username: tokenPayload.username,
        repoName: tokenPayload.repoName,
        branchName: tokenPayload.branchName,
      });

      const res = await server.inject({
        method,
        url,
        headers: {
          'authorization': token,
          'user-agent': 'chrome1',
        },
      });

      assert.equal(res.statusCode, 403);
      assert.equal(JSON.parse(res.payload).message, 'Same browser and machine should be used');
    });
  }

});
