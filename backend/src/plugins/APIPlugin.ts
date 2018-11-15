/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the API plugin.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as boom from 'boom';
import * as config from 'config';
import * as Hapi from 'hapi';
import * as _ from 'lodash';

import * as helper from '../utils/helper';

import apis from './apis';

export default {
  name: 'APIPlugin',
  register: (server: Hapi.Server) => {
    const controllers = {};

    // Add api routes
    _.each(apis, (api) => {
      if (!controllers[api.controller]) {
        controllers[api.controller] = require(`../controllers/${api.controller}`);
      }
      server.route({
        method: api.method,
        path: `/api/${config.apiVersion}${api.path}`,
        options: api.auth ? { auth: 'auth' } : {},
        handler: async (request, h) => {
          try {
            const result = await controllers[api.controller][api.function](request, h);
            return h.response(result).code(result ? 200 : 204); // 204 for No Content
          } catch (err) {
            helper.logFullError(err, `${api.controller}#${api.function}`);
            if (boom.isBoom(err)) {
              throw err;
            }
            const statusCode = err.statusCode || err.status || 500;
            return h.response({
              statusCode,
              message: _.defaultTo(err.message, 'An internal server error occurred'),
            }).code(statusCode);
          }
        },
      });
    });

    // Add public directory route
    server.route({
      method: 'GET',
      path: '/{path*}',
      handler: {
        directory: {
          path: './public',
          listing: false,
          index: true,
        },
      },
    });
  },
};
