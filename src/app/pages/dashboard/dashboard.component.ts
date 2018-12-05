import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog, Sort } from '@angular/material';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable, combineLatest, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { take, map, withLatestFrom } from 'rxjs/operators';

import { percyConfig } from 'config';
import { User } from 'models/auth';
import { ConfigFile } from 'models/config-file';
import * as appStore from 'store';
import { SelectApp, CollapseApps, ToggleApp, TableSort } from 'store/actions/dashboard.actions';
import { DeleteFile, CommitChanges, Refresh } from 'store/actions/backend.actions';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { SelectAppDialogComponent } from 'components/select-app-dialog/select-app-dialog.component';

import * as _ from 'lodash';

/*
  Dashboard page
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  collapsedApps: Observable<string[]> = this.store.pipe(select(appStore.getCollapsedApps));
  allAppsExpanded: Observable<boolean> = this.collapsedApps.pipe(map(c => !c.length));
  tableSort: Observable<any> = this.store.pipe(select(appStore.getTableSort));
  currentUser: Observable<User> = this.store.pipe(select(appStore.getCurrentUser));
  selectedApp: Observable<string> = this.store.pipe(select(appStore.getSelectedApp));
  applications: Observable<string[]> = this.store.pipe(select(appStore.getApplications));
  isDeleting: Observable<boolean> = this.store.pipe(select(appStore.getDashboardFileDeleting));
  isCommitting: Observable<boolean> = this.store.pipe(select(appStore.getDashboardCommittingFile));
  isRefreshing: Observable<boolean> = this.store.pipe(select(appStore.getDashboardRefreshing));

  folders = new BehaviorSubject<any[]>(null);
  disableCommit = new BehaviorSubject<boolean>(true);
  foldersSubscription: Subscription;

  displayedColumns: string[] = ['applicationName', 'fileName', 'actions'];
  envFileName;

  /**
   * initializes the component
   * @param store the application store
   * @param router the router instance
   * @param dialog the material dialog instance
   */
  constructor(
    private store: Store<appStore.AppState>,
    private router: Router,
    private dialog: MatDialog
  ) { }

  /**
   * handle component initialization
   */
  ngOnInit() {
    this.envFileName = percyConfig.environmentsFile;
    const folders$ = new Subject<any[]>();

    folders$.subscribe(this.folders);

    folders$.subscribe((files) => {
      const modified = files.filter((f) => f.appFile && f.appFile.modified);
      this.disableCommit.next(!modified.length);
    });

    this.foldersSubscription = combineLatest(this.store.pipe(select(appStore.getAllFiles)),
      this.store.pipe(select(appStore.dashboardState))).pipe(
        map(([grouped, dashboardState]) => {

          const apps = _.keys(grouped);

          const result = [];

          _.orderBy(apps, [], [dashboardState.tableSort.applicationName]).forEach(app => {
            if (dashboardState.selectedApp && dashboardState.selectedApp !== app) {
              return;
            }
            const appFiles = _.orderBy(grouped[app], ['fileName'], [dashboardState.tableSort.fileName]);
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
          return result;
        })
      ).subscribe(folders$);
  }

  ngOnDestroy() {
    this.foldersSubscription.unsubscribe();
  }

  toggleApp(app) {
    this.store.dispatch(new ToggleApp(app));
  }

  toggleAllApps($event) {
    $event.stopPropagation();
    this.allAppsExpanded.pipe(take(1), withLatestFrom(this.applications)).subscribe(([allExpanded, apps]) => {
      const result = [];
      if (allExpanded) {
        apps.forEach(app => {
          result.push(app);
        });
      }
      this.store.dispatch(new CollapseApps(result));
    });
  }

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
    this.store.pipe(select(appStore.getAppState)).pipe(take(1)).subscribe(appState => {

      const envFileName = this.envFileName;

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
            this.router.navigate(['/files/newenv', data.appName, envFileName]);
          } else {
            this.router.navigate(['/files/new', data.appName]);
          }
        }
      });
    });
  }

  editFile(file) {
    this.router.navigate([file.fileName === this.envFileName ? '/files/editenv' : '/files/edit', file.applicationName, file.fileName]);
  }

  /**
   * Commit changes.
   */
  commitChanges() {

    const files = this.folders.value;
    const modified = files.filter((f) => f.appFile && f.appFile.modified).map(f => ({ ...f.appFile }));
    const dialogRef = this.dialog.open(CommitDialogComponent);

    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        this.store.dispatch(new CommitChanges({
          files: modified,
          message: response,
        }));
      }
    });
  }

  /**
   * deletes the file
   * @param file the file to delete
   */
  deleteFile(file: ConfigFile) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Delete ${file.applicationName} / ${file.fileName} ?`
      }
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        this.store.dispatch(new DeleteFile(file));
      }
    });
  }

  /**
   * pull repo to refresh.
   */
  refresh() {
    this.store.dispatch(new Refresh());
  }
}
