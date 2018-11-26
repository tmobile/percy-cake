import { Injectable } from '@angular/core';
import * as path from 'path';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { getGitFS } from './git-fs.service';

/**
 * This service provides the methods around the maintenance API endpoints
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {

    /**
     * the user names cache variable
     */
    private userNamesCache: any;

    /**
     * initializes the service
     */
    constructor() { }

    /**
     * gets the user type ahead based on prefix
     * @param prefix the prefix
     */
    async getUserTypeAhead(prefix: string) {
      if (!this.userNamesCache) {
        const { fs } = await getGitFS();
        const loggedInUsersMetaFile = path.resolve(percyConfig.metaFolder, percyConfig.loggedInUsersMetaFile);
        if (await fs.exists(loggedInUsersMetaFile)) {
          this.userNamesCache = await fs.readJson(loggedInUsersMetaFile);
        } else {
          this.userNamesCache = [];
        }
      }
      return _.filter(this.userNamesCache, (i) => i.toUpperCase().indexOf(prefix.toUpperCase()) !== -1);
    }

    async addUserName(user) {
      this.userNamesCache = _.union(this.userNamesCache || [], [user]);

      const { fs } = await getGitFS();
      const loggedInUsersMetaFile = path.resolve(percyConfig.metaFolder, percyConfig.loggedInUsersMetaFile);
      await fs.outputJson(loggedInUsersMetaFile, this.userNamesCache);
    }
}
