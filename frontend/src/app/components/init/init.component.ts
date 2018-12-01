import { OnInit, Component } from "@angular/core";
import { Store, select } from '@ngrx/store';
import * as fromStore from 'store';
import { take } from 'rxjs/operators';
import * as path from 'path';
import * as boom from 'boom';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { UtilService } from 'services/util.service';
import { MaintenanceService } from 'services/maintenance.service';
import { FileManagementService } from 'services/file-management.service';
import { getBrowserFS } from 'services/git-fs.service';
import { User } from 'models/auth';
import { Initialized } from 'store/actions/backend.actions';
import { APIError } from "store/actions/common.actions";

@Component({
  selector: 'app-init',
  templateUrl: './init.component.html',
  styleUrls: ['./init.component.scss']
})
export class InitComponent implements OnInit {

  error;

  /**
   * initializes the service
   * @param store the store instance
   */
  constructor(
    private store: Store<fromStore.AppState>,
    private utilService: UtilService,
    private maintenanceService: MaintenanceService,
    private fileManagementService: FileManagementService) {
  }

  /**
   * handle component initialization
   */
  ngOnInit() {
    this.store.pipe(select(fromStore.getCurrentUser), take(1)).subscribe(async (user) => {
      try {
        const principal = await this.initialize(user);
        await this.maintenanceService.checkSessionTimeout(principal);
        this.store.dispatch(new Initialized({principal}));
      } catch (err) {
        this.error = err;
        this.store.dispatch(new APIError(err));
      }
    });
  }

  /**
   * Initialize git fs, and validate logged in user and repo metadata.
   * @param user the logged in user
   * @returns the user principal
   */
  private async initialize(user: User) {
    // Wait BrowserFS initialize
    const fs = await getBrowserFS();

    // Validate user
    if (!user || !user.token) {
      throw boom.unauthorized('Miss access token');
    }

    try {
      JSON.parse(this.utilService.decrypt(user.token));
    } catch (err) {
      throw boom.unauthorized('Invalid access token');
    }

    // Validate repo metadata
    const repoMetadataFile = this.utilService.getMetadataPath(user.repoFolder);
    if (!await fs.exists(repoMetadataFile)) {
      throw boom.unauthorized('Repo metadata not found');
    }

    let repoMetadata: any = await fs.readFile(repoMetadataFile);
    try {
      repoMetadata = JSON.parse(repoMetadata.toString());
    } catch (err) {
      // Not a valid json format, repo metadata file corruption, remove it
      console.warn(`${repoMetadataFile} file corruption, will be removed:\n${repoMetadata}`);
      await fs.remove(repoMetadataFile);
      throw boom.unauthorized('Repo metadata file corruption');
    }

    // Verify with repo metadata
    if (!_.isEqual(_.omit(user, 'password'),
      _.omit(repoMetadata, 'password', 'commitBaseSHA', 'version'))) {
      throw boom.forbidden('Repo metadata mismatch, you are not allowed to access the repo');
    }

    const password = this.utilService.decrypt(repoMetadata.password);
    user = {...user, password};

    // Make sure the repo is cloned
    const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
    if (!(await fs.exists(repoDir))) {
      await this.fileManagementService.clone(fs, user, repoDir);
    }

    return {user, repoMetadata};
  }
}
