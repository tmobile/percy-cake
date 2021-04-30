/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { Injectable, NgZone } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as fs from "fs-extra";
import * as aesjs from "aes-js";
import * as pbkdf2 from "pbkdf2";
import * as path from "path";
import * as HttpErrors from "http-errors";
import * as _ from "lodash";

import { percyConfig, electronApi } from "config";
import { Authenticate } from "models/auth";
import filesystem from "filesystem/filesystem";

import { YamlService } from "./yaml.service";

export const git = filesystem.git;
export type FS = typeof fs;

/**
 * This service provides the utility methods
 */
@Injectable({ providedIn: "root" })
export class UtilService extends YamlService {
  /**
   * initializes the service
   */
  constructor(private http: HttpClient, private ngZone: NgZone) {
    super();
  }

  /**
   * Wrap the function in angular zone.
   *
   * @param func The function to wrap
   */
  wrapInZone(func) {
    return (...args) => {
      this.ngZone.run(() => {
        func(...args);
      });
    };
  }

  /**
   * Init config.
   */
  async initConfig() {
    if (_.isEmpty(percyConfig)) {
      const config = await this.http.get("percy.conf.json").toPromise();
      _.assign(percyConfig, config);
      if (electronApi) {
        _.assign(percyConfig, electronApi.getPreferences());
      }
    }
  }

  /**
   * Get browser filesytem.
   */
  async getBrowserFS() {
    if (filesystem.initialized()) {
      return fs;
    }

    await this.initConfig();

    await filesystem.initialize();

    await fs.ensureDir(percyConfig.reposFolder);
    await fs.ensureDir(percyConfig.draftFolder);
    await fs.ensureDir(percyConfig.metaFolder);

    console.info("Browser Git initialized"); // eslint-disable-line
    return fs;
  }

  /**
   * Encrypt.
   *
   * @param text The text to encrypt
   * @returns encrypted text
   */
  encrypt(text: string): string {
    const textBytes = aesjs.utils.utf8.toBytes(text);
    const aesKey = pbkdf2.pbkdf2Sync(
      percyConfig.encryptKey,
      percyConfig.encryptSalt,
      1,
      32
    );

    const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
    const encryptedBytes = aesCtr.encrypt(textBytes);

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  /**
   * Decrypt.
   *
   * @param encrypted The encrypted text
   * @returns decrypted text
   */
  decrypt(encrypted: string): string {
    const encryptedBytes = aesjs.utils.hex.toBytes(encrypted);
    const aesKey = pbkdf2.pbkdf2Sync(
      percyConfig.encryptKey,
      percyConfig.encryptSalt,
      1,
      32
    );

    const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  /**
   * Convert Git error.
   *
   * @param err The Git error
   * @returns converted error
   */
  convertGitError(err) {
    if (err && err.data && err.data.statusCode === 401) {
      return new HttpErrors.Unauthorized("Invalid username or password");
    }

    if (err && err.data && err.data.statusCode === 403) {
      return new HttpErrors.Forbidden("Git authorization forbidden");
    }

    if (err && err.data && err.data.statusCode === 404) {
      return new HttpErrors.NotFound("Repository not found");
    }

    const resultErr = new HttpErrors.InternalServerError(err.message);
    resultErr.data = err.data;
    resultErr.code = err.code;

    return resultErr;
  }

  /**
   * Get repo name.
   *
   * @param url The repo url
   * @returns the repo name
   */
  private getRepoName(url: URL) {
    const split = url.pathname.split("/");
    return split.filter(e => e).join("/");
  }

  /**
   * Get repo folder name.
   *
   * @param auth The authenticate
   * @returns the repo folder name
   */
  getRepoFolder(auth: Authenticate) {
    const repoName = this.getRepoName(new URL(auth.repositoryUrl));

    // Construct folder name by combining username, repoName
    const repoFolder = encodeURIComponent(`${auth.username}!${repoName}`);
    return { repoName, repoFolder };
  }

  /**
   * Get metadata file path.
   *
   * @param repoFolder The repo folder name
   * @returns the path to metadata file
   */
  getMetadataPath(repoFolder: string) {
    return path.resolve(percyConfig.metaFolder, `${repoFolder}.meta`);
  }
}
