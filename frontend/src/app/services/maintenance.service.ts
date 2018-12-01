import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as path from 'path';
import * as boom from 'boom';
import * as ms from 'ms';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { getBrowserFS } from './git-fs.service';
import { Principal } from 'models/auth';

export const sessionsMetaFile = path.resolve(percyConfig.metaFolder, 'user-session.json');
export const loggedInUsersMetaFile = path.resolve(percyConfig.metaFolder, percyConfig.loggedInUsersMetaFile);

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
     * the user session cache variable
     */
    private userSessionsCache: {[username: string]: number};
    private userSessions$ = new BehaviorSubject(null);

    /**
     * initializes the service
     */
    constructor() {
      this.userSessions$.pipe(debounceTime(500)).subscribe(async () => {
        if (this.userSessionsCache) {
          try {
            const fs = await getBrowserFS();
            await fs.outputJson(sessionsMetaFile, this.userSessionsCache);
          } catch(err) {
            console.warn(err);
          }
        }
      });
    }

  /**
   * Check user session timeout.
   * @param principal the logged in user principal
   */
    async checkSessionTimeout(principal: Principal) {
      const fs = await getBrowserFS();
      const { user } = principal;
      const username = user.username;
  
      if (!this.userSessionsCache) {
        try {
          if (await fs.exists(sessionsMetaFile)) {
            this.userSessionsCache = await fs.readJson(sessionsMetaFile);
          }
        } catch (err) {
          console.warn(err);
        }
      }
  
      this.userSessionsCache = this.userSessionsCache || {};
      if (this.userSessionsCache[username] && this.userSessionsCache[username] < Date.now()) {
        delete this.userSessionsCache[username];
        this.userSessions$.next(this.userSessionsCache);
        throw boom.unauthorized('Session expired, please re-login');
      };
  
      this.userSessionsCache[username] = Date.now() + ms(percyConfig.loginSessionTimeout);
      this.userSessions$.next(this.userSessionsCache);

      return principal;
    }

    /**
     * gets the user type ahead based on prefix
     * @param prefix the prefix
     */
    async getUserTypeAhead(prefix: string) {
      if (!this.userNamesCache) {
        const fs = await getBrowserFS();
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

      const fs = await getBrowserFS();
      await fs.outputJson(loggedInUsersMetaFile, this.userNamesCache);
    }
}
