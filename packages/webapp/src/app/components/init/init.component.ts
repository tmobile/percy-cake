/**
=========================================================================
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

import { OnInit, Component } from "@angular/core";
import { Store, select } from "@ngrx/store";
import * as fromStore from "store";
import { take } from "rxjs/operators";
import * as HttpErrors from "http-errors";
import * as _ from "lodash";

import { percyConfig } from "config";
import { UtilService } from "services/util.service";
import { MaintenanceService } from "services/maintenance.service";
import { User } from "models/auth";
import { Initialized } from "store/actions/backend.actions";
import { APIError } from "store/actions/common.actions";

@Component({
  selector: "app-init",
  templateUrl: "./init.component.html",
  styleUrls: ["./init.component.scss"]
})
export class InitComponent implements OnInit {
  error;

  /**
   * initializes the service
   * @param store the store instance
   * @param utilService the util server
   * @param maintenanceService the maintenance service
   */
  constructor(
    private store: Store<fromStore.AppState>,
    private utilService: UtilService,
    private maintenanceService: MaintenanceService
  ) {}

  /**
   * handle component initialization
   */
  ngOnInit() {
    this.store
      .pipe(
        select(fromStore.getCurrentUser),
        take(1)
      )
      .subscribe(async user => {
        try {
          const principal = await this.initialize(user);
          await this.maintenanceService.checkSessionTimeout(principal);
          this.store.dispatch(new Initialized({ principal }));
        } catch (err) {
          this.error = err;
          this.store.dispatch(new APIError(err));
        }
      });
  }

  /**
   * Initialize browser fs, validate logged in user and repo metadata.
   * @param user the logged in user
   * @returns the user principal and repo metadata
   */
  private async initialize(user: User) {
    // Wait BrowserFS initialize
    const fs = await this.utilService.getBrowserFS();

    // Validate user
    if (!user || !user.token) {
      throw new HttpErrors.Unauthorized("Miss access token");
    }

    try {
      JSON.parse(this.utilService.decrypt(user.token));
    } catch (err) {
      throw new HttpErrors.Unauthorized("Invalid access token");
    }

    // Validate repo metadata
    const repoMetadataFile = this.utilService.getMetadataPath(user.repoFolder);
    if (!(await fs.pathExists(repoMetadataFile))) {
      throw new HttpErrors.Unauthorized("Repo metadata not found");
    }

    let repoMetadata: any = await fs.readFile(repoMetadataFile);
    try {
      repoMetadata = JSON.parse(repoMetadata.toString());
    } catch (err) {
      // Not a valid json format, repo metadata file corruption, remove it
      console.warn(
        `${repoMetadataFile} file corruption, will be removed:\n${repoMetadata}`
      );
      await fs.remove(repoMetadataFile);
      throw new HttpErrors.Unauthorized("Repo metadata file corruption");
    }

    // Verify with repo metadata
    if (
      !_.isEqual(
        {
          ..._.omit(user, "password"),
          version: percyConfig.repoMetadataVersion
        },
        _.omit(repoMetadata, "password", "commitBaseSHA")
      )
    ) {
      throw new HttpErrors.Forbidden(
        "Repo metadata mismatch, you are not allowed to access the repo"
      );
    }

    const password = this.utilService.decrypt(repoMetadata.password);
    user = { ...user, password };

    return { user, repoMetadata };
  }
}
