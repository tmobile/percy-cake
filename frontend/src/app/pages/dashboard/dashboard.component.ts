import { Component, OnInit } from '@angular/core';
import { MatDialog, Sort } from '@angular/material';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { take, map } from 'rxjs/operators';

import { ConfigFile } from '../../models/config-file';
import * as appStore from '../../store';
import { Alert } from '../../store/actions/common.actions';
import { SelectApp } from '../../store/actions/dashboard.actions';
import { DeleteFile, CommitChanges } from '../../store/actions/backend.actions';
import { GetConfigFile } from '../../store/reducers/backend.reducers';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from '../../components/commit-dialog/commit-dialog.component';
import { SelectAppDialogComponent } from '../../components/select-app-dialog/select-app-dialog.component';

import * as _ from 'lodash';

/*
  Dashboard page
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  sort$: BehaviorSubject<Sort> = new BehaviorSubject(undefined);

  repositoryName: Observable<string> = this.store.pipe(select(appStore.getRepositoryName));
  selectedApp: Observable<string> = this.store.pipe(select(appStore.getSelectedApp));
  applications: Observable<string[]> = this.store.pipe(select(appStore.getApplications));
  files: Observable<ConfigFile[]> = combineLatest(this.store.pipe(select(appStore.getAppFiles)), this.selectedApp, this.sort$).pipe(
    map(([appFiles, applicationName, sort]) => {
      const result = appFiles.filter((f) => !applicationName || applicationName === f.applicationName);
      if (!sort || !sort.active || !sort.direction) {
        return result;
      }
      const sorted = _.sortBy(result, sort.active);
      return sort.direction === 'asc' ? sorted : _.reverse(sorted);
    })
  );

  isDeleting = this.store.pipe(select(appStore.getDashboardFileDeleting));
  isCommitting = this.store.pipe(select(appStore.getDashboardCommittingFile));

  displayedColumns: string[] = ['id', 'fileName', 'applicationName', 'actions'];

  envFileName: string;

  disableCommit = this.files.pipe(map(appFiles => {
    const modified = appFiles.filter((f) => f.modified).map(f => ({...f}));
    return !modified.length;
  }));
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
    this.store.pipe(select(appStore.getCurrentUser)).pipe(take(1)).subscribe(user => {
      this.envFileName = user.envFileName;
    });
  }

  onSortChange(sort: Sort) {
    this.sort$.next(sort);
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

      const envFileName = appState.auth.currentUser.envFileName;

      const dialogRef = this.dialog.open(SelectAppDialogComponent, {
        data: {
          envFileName,
          applications: appState.backend.applications,
          selectedApp: appState.dashboard.selectedApp,
          canCreateEnv: (appName) => {
            const envFile = GetConfigFile(appState.backend, envFileName, appName);
            return !envFile;
          }
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
    this.files.pipe(take(1)).subscribe(appFiles => {
      const modified = appFiles.filter((f) => f.modified).map(f => ({...f}));

      if (!modified.length) {
        return this.store.dispatch(new Alert({ message: 'No files changed', editorType: 'info' }));
      }
      const dialogRef = this.dialog.open(CommitDialogComponent);

      dialogRef.afterClosed().subscribe(response => {
        if (response) {
          this.store.dispatch(new CommitChanges({
            files: modified,
            message: response,
          }));
        }
      });
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
}
