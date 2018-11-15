/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the plugin to init the app.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as path from 'path';

import * as config from 'config';
import * as fs from 'fs-extra';

import Cache from '../utils/cache';
import * as helper from '../utils/helper';

export default {
  name: 'InitPlugin',
  register: async () => {

    // Load external config
    await helper.loadExtConfig(process.env.EXTERNAL_CONFIG_URL);

    // Create repos folder
    config.reposFolder = path.resolve(config.reposFolder);
    fs.ensureDirSync(config.reposFolder);
    helper.logger.info(`Use repos folder: ${config.reposFolder}`);

    // Create meta folder
    config.metaFolder = path.resolve(config.metaFolder);
    fs.ensureDirSync(config.metaFolder);
    helper.logger.info(`Use meta folder: ${config.metaFolder}`);

    // Load cached users
    const loggedInUsersMetaFile = `${config.metaFolder}/${config.loggedInUsersMetaFile}`;
    if (fs.existsSync(loggedInUsersMetaFile)) {
      Cache.set('users', fs.readJsonSync(loggedInUsersMetaFile));
    } else {
      Cache.set('users', []);
    }
  },
};
