/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the auth plugin.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as boom from 'boom';
import * as config from 'config';
import * as fs from 'fs-extra';
import * as Hapi from 'hapi';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';

import * as helper from '../utils/helper';

/**
 * Authenticate request for JWT token.
 * @param request Hapi request
 * @param h Hapi response toolkit
 */
function authenticate(request: Hapi.Request, h: Hapi.ResponseToolkit) {
  try {
    let token = request.headers.authorization;
    if (!token) {
      throw boom.unauthorized('Miss access token');
    }
    token = token.replace(/^Bearer /, '');

    // Verify and decode token payload
    let tokenPayload;
    try {
      tokenPayload = jwt.verify(token, config.jwtSecret);
    } catch (jwtErr) {
      throw boom.unauthorized(jwtErr.name === 'TokenExpiredError' ? 'Expired access token' : 'Invalid access token');
    }

    // Find stored repo metadata
    const repoMetadataFile = helper.getMetadataPath(tokenPayload);
    if (!fs.existsSync(repoMetadataFile)) {
      throw boom.unauthorized('Repo metadata not found');
    }

    // Check with stored repo metadata to verify user having access to the repo
    tokenPayload.token = token;
    const storedRepoMetadata = helper.checkRepoAccess(tokenPayload, repoMetadataFile,
      ['username', 'repoName', 'branchName', 'token']);

    // verify same browser request
    if (request.info.remoteAddress !== tokenPayload.ip ||
      request.headers['user-agent'] !== tokenPayload.userAgent) {
      throw boom.forbidden('Same browser and machine should be used');
    }

    // Set the repo metadata as auth credentials
    return h.authenticated({
      credentials: {
        user: _.pick(storedRepoMetadata, ['repoURL', 'username', 'password', 'repoName', 'branchName']),
      },
    });
  } catch (err) {
    helper.logFullError(err, 'authenticate');
    throw err;
  }
}

export default {
  name: 'AuthPlugin',
  register: (server: Hapi.Server) => {
    server.auth.scheme('jwt', () => ({ authenticate }));
    server.auth.strategy('auth', 'jwt');
  },
};
