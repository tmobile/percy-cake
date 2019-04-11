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

import { Component, OnInit, OnDestroy } from "@angular/core";
import { MatDialog, Sort, MatIconRegistry } from "@angular/material";
import { Router } from "@angular/router";
import { DomSanitizer } from "@angular/platform-browser";
import { Store, select } from "@ngrx/store";
import {
  Observable,
  combineLatest,
  Subject,
  BehaviorSubject,
  Subscription
} from "rxjs";
import { take, map, withLatestFrom } from "rxjs/operators";

import { percyConfig } from "config";
import { User } from "models/auth";
import { ConfigFile } from "models/config-file";
import * as appStore from "store";
import {
  SelectApp,
  CollapseApps,
  ToggleApp,
  TableSort
} from "store/actions/dashboard.actions";
import {
  DeleteFile,
  CommitChanges,
  Refresh,
  MergeBranch
} from "store/actions/backend.actions";
import { ConfirmationDialogComponent } from "components/confirmation-dialog/confirmation-dialog.component";
import { CommitDialogComponent } from "components/commit-dialog/commit-dialog.component";
import { SelectAppDialogComponent } from "components/select-app-dialog/select-app-dialog.component";

import * as _ from "lodash";
import { YamlService } from "services/yaml.service";

const commitIcon = require("../../../assets/icon-commit.svg");
const addFileIcon = require("../../../assets/icon-add-file.svg");
const syncIcon = require("../../../assets/icon-sync.svg");
const pullRequestIcon = require("../../../assets/icon-pull-request.svg");
const refreshIcon = require("../../../assets/icon-refresh.svg");

/*
  Dashboard page
 */
@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"]
})
export class DashboardComponent implements OnInit, OnDestroy {
  collapsedApps: Observable<string[]> = this.store.pipe(
    select(appStore.getCollapsedApps)
  );
  allAppsExpanded: Observable<boolean> = this.collapsedApps.pipe(
    map(c => !c.length)
  );
  tableSort: Observable<any> = this.store.pipe(select(appStore.getTableSort));
  currentUser: Observable<User> = this.store.pipe(
    select(appStore.getCurrentUser)
  );
  selectedApp: Observable<string> = this.store.pipe(
    select(appStore.getSelectedApp)
  );
  applications: Observable<string[]> = this.store.pipe(
    select(appStore.getApplications)
  );
  appConfigs: Observable<{ [app: string]: any }> = this.store.pipe(
    select(appStore.getAppConfigs)
  );
  isDeleting: Observable<boolean> = this.store.pipe(
    select(appStore.getDashboardFileDeleting)
  );
  isCommitting: Observable<boolean> = this.store.pipe(
    select(appStore.getDashboardCommittingFile)
  );
  isRefreshing: Observable<boolean> = this.store.pipe(
    select(appStore.getDashboardRefreshing)
  );
  canPullRequest: Observable<boolean> = this.store.pipe(
    select(appStore.getCanPullRequest)
  );
  canSyncMaster: Observable<boolean> = this.store.pipe(
    select(appStore.getCanSyncMaster)
  );

  folders = new BehaviorSubject<any[]>(null);
  modifiedFiles = new BehaviorSubject<any[]>(null);
  disableCommit = new BehaviorSubject<boolean>(true);
  foldersSubscription: Subscription;

  displayedColumns: string[] = ["applicationName", "fileName", "actions"];
  pullRequestUrl: string;
  pullRequestTooltip: string;

  /**
   * creates the component
   * @param store the application store
   * @param router the router instance
   * @param dialog the material dialog instance
   */
  constructor(
    private store: Store<appStore.AppState>,
    private router: Router,
    private dialog: MatDialog,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private yamlService: YamlService
  ) {
    _.each(
      {
        commit: commitIcon,
        add_file: addFileIcon,
        sync: syncIcon,
        pull_request: pullRequestIcon,
        refresh: refreshIcon
      },
      (icon, key) => {
        this.matIconRegistry.addSvgIconLiteral(
          key,
          this.domSanitizer.bypassSecurityTrustHtml(icon)
        );
      }
    );
  }

  /**
   * handle component initialization
   */
  ngOnInit() {
    const folders$ = new Subject<any[]>();

    folders$.subscribe(this.folders);

    this.foldersSubscription = combineLatest(
      this.store.pipe(select(appStore.getAllFiles)),
      this.store.pipe(select(appStore.dashboardState))
    )
      .pipe(
        map(([grouped, dashboardState]) => {
          const apps = _.keys(grouped);

          const result = [];
          let modified = [];

          _.orderBy(
            apps,
            [],
            [dashboardState.tableSort.applicationName]
          ).forEach(app => {
            if (
              dashboardState.selectedApp &&
              dashboardState.selectedApp !== app
            ) {
              return;
            }

            let appFiles = _.orderBy(
              grouped[app],
              ["fileName"],
              [dashboardState.tableSort.fileName]
            );
            const envFile = appFiles.find(
              f => f.fileName === percyConfig.environmentsFile
            );
            if (envFile) {
              appFiles = [
                envFile,
                ...appFiles.filter(
                  f => f.fileName !== percyConfig.environmentsFile
                )
              ];
            }

            modified = _.concat(modified, appFiles.filter(f => f.modified));

            result.push({
              app
            });
            if (!_.includes(dashboardState.collapsedApps, app)) {
              appFiles.forEach(appFile => {
                result.push({
                  app,
                  appFile
                });
              });
            }
          });

          this.disableCommit.next(!modified.length);
          this.modifiedFiles.next(modified);
          return result;
        })
      )
      .subscribe(folders$);

    this.currentUser.subscribe(user => {
      if (user) {
        this.pullRequestTooltip = "Pull Request";
        const url = new URL(user.repositoryUrl);
        if (url.hostname.endsWith("bitbucket.org")) {
          this.pullRequestUrl = `${url.href}/pull-requests/new?source=${
            user.branchName
          }&t=1#diff`;
        } else if (url.hostname.endsWith("github.com")) {
          this.pullRequestUrl = `${url.href}/pull/new/${user.branchName}`;
        } else if (url.hostname.endsWith("gitlab.com")) {
          this.pullRequestTooltip = "Merge Request";
          this.pullRequestUrl = `${
            url.href
          }/merge_requests/new/diffs?merge_request%5Bsource_branch%5D=${
            user.branchName
          }`;
        } else {
          this.pullRequestUrl = null;
        }
      }
    });
  }

  /**
   * Get app's specific percy config
   */
  getAppConfigTooltip(appConfig) {
    return this.yamlService.getAppConfigTooltip(appConfig);
  }

  /**
   * Check if file is env file.
   * @param file the file to check
   * @returns true if file is env file, false otherwise
   */
  isEnvFile(file: ConfigFile) {
    return file.fileName === percyConfig.environmentsFile;
  }

  /**
   * Hook invoked when component destory.
   */
  ngOnDestroy() {
    this.foldersSubscription.unsubscribe();
  }

  /**
   * Expand/collapse an application.
   * @param app the application to expand/collapse
   */
  toggleApp(app) {
    this.store.dispatch(new ToggleApp(app));
  }

  /**
   * Expand/collapse all applications.
   * @param $event the toggle event
   */
  toggleAllApps($event) {
    $event.stopPropagation();
    this.allAppsExpanded
      .pipe(
        take(1),
        withLatestFrom(this.applications)
      )
      .subscribe(([allExpanded, apps]) => {
        const result = [];
        if (allExpanded) {
          apps.forEach(app => {
            result.push(app);
          });
        }
        this.store.dispatch(new CollapseApps(result));
      });
  }

  /**
   * On sort column/order change.
   * @param sort the new sort column/order
   */
  onSortChange(sort: Sort) {
    this.store.dispatch(new TableSort({ [sort.active]: sort.direction }));
  }

  /**
   * On select application.
   * @param $event the selection event
   */
  onSelectApp($event) {
    this.store.dispatch(new SelectApp($event.value));
  }

  /**
   * Add new file.
   */
  addNewFile() {
    this.store
      .pipe(select(appStore.getAppState))
      .pipe(take(1))
      .subscribe(appState => {
        const envFileName = percyConfig.environmentsFile;

        const dialogRef = this.dialog.open(SelectAppDialogComponent, {
          data: {
            envFileName,
            applications: appState.backend.applications,
            selectedApp: appState.dashboard.selectedApp,
            files: _.values(appState.backend.files.entities)
          },
          autoFocus: false
        });

        dialogRef.afterClosed().subscribe(data => {
          if (data) {
            if (data.createEnv) {
              this.router.navigate([
                "/files/newenv",
                data.appName,
                envFileName
              ]);
            } else {
              this.router.navigate(["/files/new", data.appName]);
            }
          }
        });
      });
  }

  /**
   * Edit existing file.
   * @param file the file to edit
   */
  editFile(file: ConfigFile) {
    this.router.navigate([
      file.fileName === percyConfig.environmentsFile
        ? "/files/editenv"
        : "/files/edit",
      file.applicationName,
      file.fileName
    ]);
  }

  /**
   * Commit changes.
   */
  commitChanges() {
    const modified = this.modifiedFiles.value;
    const dialogRef = this.dialog.open(CommitDialogComponent);
    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        this.store.dispatch(
          new CommitChanges({
            files: modified,
            message: response
          })
        );
      }
    });
  }

  /**
   * Deletes the file
   * @param file the file to delete
   */
  deleteFile(file: ConfigFile) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Delete ${file.applicationName}/${file.fileName} ?`,
        delete: true
      }
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        this.store.dispatch(new DeleteFile(file));
      }
    });
  }

  /**
   * Pull repo to refresh.
   */
  refresh() {
    this.store.dispatch(new Refresh());
  }

  /**
   * Sync master.
   */
  syncMaster() {
    this.currentUser.pipe(take(1)).subscribe(user => {
      this.store.dispatch(
        new MergeBranch({
          srcBranch: "master",
          targetBranch: user.branchName
        })
      );
    });
  }
}
