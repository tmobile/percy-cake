/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the Hapi server.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as config from 'config';
import * as Hapi from 'hapi';
import * as Inert from 'inert';

import APIPlugin from './plugins/APIPlugin';
import AuthPlugin from './plugins/AuthPlugin';
import InitPlugin from './plugins/InitPlugin';

import * as helper from './utils/helper';

/**
 * Start Hapi server.
 * @returns Hapi server
 */
export async function start() {

  // Create Hapi server
  const server = new Hapi.Server({
    port: config.port,
    routes: {
      cors: {
        origin: ['*'],
      },
      payload: {
        allow: ['application/json'],
        maxBytes: config.maxPayloadSize,
        multipart: false,
      },
    },
  });

  // Register plugins
  await server.register([InitPlugin, Inert, AuthPlugin, APIPlugin]);

  // Start server
  await server.start();
  helper.logger.info(`Hapi server running at: ${config.port}`);

  return server;
}
