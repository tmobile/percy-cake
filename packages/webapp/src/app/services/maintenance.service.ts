/**
 *   Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as path from 'path';
import * as HttpErrors from 'http-errors';
import * as ms from 'ms';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { UtilService } from './util.service';
import { Principal } from 'models/auth';

/**
 * This service provides the methods around the maintenance API endpoints
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {

  /**
   * the user names cache variable
   */
  private userNamesCache: string[];

  /**
   * the user session cache variable
   */
  private userSessionsCache: { [username: string]: number };
  private userSessions$ = new BehaviorSubject(null);

  /**
   * Creats the service
   * @param utilService the util service
   */
  constructor(private utilService: UtilService) {
    this.userSessions$.pipe(debounceTime(500)).subscribe(async () => {
      if (this.userSessionsCache) {
        try {
          const fs = await this.utilService.getBrowserFS();
          const sessionsMetaFile = path.resolve(percyConfig.metaFolder, 'user-session.json');
          await fs.outputJson(sessionsMetaFile, this.userSessionsCache);
        } catch (err) {
          console.warn(err);
        }
      }
    });
  }

  /**
   * Check user session timeout.
   * @param principal the logged in user principal
   * @returns given principal
   */
  async checkSessionTimeout(principal: Principal) {
    const fs = await this.utilService.getBrowserFS();
    const { user } = principal;
    const username = user.username;

    if (!this.userSessionsCache) {
      const sessionsMetaFile = path.resolve(percyConfig.metaFolder, 'user-session.json');
      if (await fs.pathExists(sessionsMetaFile)) {
        try {
          this.userSessionsCache = await fs.readJson(sessionsMetaFile);
        } catch (err) {
          console.warn('Invalid user session file: ' + (await fs.readFile(sessionsMetaFile)).toString());
        }
      }
    }

    this.userSessionsCache = this.userSessionsCache || {};
    if (this.userSessionsCache[username] && this.userSessionsCache[username] < Date.now()) {
      delete this.userSessionsCache[username];
      this.userSessions$.next(this.userSessionsCache);
      throw new HttpErrors.Unauthorized('Session expired, please re-login');
    }

    this.userSessionsCache[username] = Date.now() + ms(percyConfig.loginSessionTimeout);
    this.userSessions$.next(this.userSessionsCache);

    return principal;
  }

  /**
   * Gets the user type ahead based on prefix
   * @param prefix the prefix
   * @returns user type ahead
   */
  async getUserTypeAhead(prefix: string) {
    if (!this.userNamesCache) {
      const fs = await this.utilService.getBrowserFS();
      const loggedInUsersMetaFile = path.resolve(percyConfig.metaFolder, percyConfig.loggedInUsersMetaFile);
      if (await fs.pathExists(loggedInUsersMetaFile)) {
        this.userNamesCache = await fs.readJson(loggedInUsersMetaFile);
      } else {
        this.userNamesCache = [];
      }
    }
    return _.filter(this.userNamesCache, (i) => i.toUpperCase().indexOf(prefix.toUpperCase()) !== -1);
  }

  /**
   * Adds user name.
   * @param username the user name
   */
  async addUserName(username: string) {
    // Update user sessions cache
    this.userSessionsCache = this.userSessionsCache || {};
    this.userSessionsCache[username] = Date.now() + ms(percyConfig.loginSessionTimeout);
    this.userSessions$.next(this.userSessionsCache);

    // Update user names cache
    const fs = await this.utilService.getBrowserFS();
    this.userNamesCache = _.union(this.userNamesCache || [], [username]);
    const loggedInUsersMetaFile = path.resolve(percyConfig.metaFolder, percyConfig.loggedInUsersMetaFile);

    await fs.outputJson(loggedInUsersMetaFile, this.userNamesCache);
  }
}
