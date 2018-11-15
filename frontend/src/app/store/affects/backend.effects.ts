import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Router } from '@angular/router';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Store, select } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, tap, map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as _ from 'lodash';

import {
    BackendActionTypes,
    ListApplications, ListApplicationsSuccess, ListApplicationsFailure,
    SaveDraft, CommitChanges, CommitChangesSuccess, CommitChangesFailure,
    LoadFiles, LoadFilesSuccess, LoadFilesFailure,
    DeleteFile, DeleteFileFailure, DeleteFileSuccess,
    GetFileContent, GetFileContentSuccess, GetFileContentFailure
} from '../actions/backend.actions';
import { FileManagementService } from '../../services/file-management.service';
import * as appStore from '..';
import { Alert, APIError, AlertClosed } from '../actions/common.actions';
import { ConflictDialogComponent } from '../../components/conflict-dialog/conflict-dialog.component';

// defines the backend related effects
@Injectable()
export class BackendEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
        private dialog: MatDialog,
        private fileManagementService: FileManagementService,
        private store: Store<appStore.AppState>
    ) { }

    // load applications effect
    @Effect()
    loadApplications$ = this.actions$.pipe(
        ofType<ListApplications>(BackendActionTypes.ListApplications),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(([action, user]) =>
            this.fileManagementService.listApplications(user.repoName, user.branchName)
                .pipe(
                    map(result => new ListApplicationsSuccess(result)),
                    catchError(error => of(new ListApplicationsFailure(error)))
                )
        )
    );

    // load files effect
    @Effect()
    loadFiles$ = this.actions$.pipe(
        ofType<LoadFiles>(BackendActionTypes.LoadFiles, BackendActionTypes.DeleteFileFailure),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(([action, user]) =>
            this.fileManagementService.getFiles(user.repoName, user.branchName)
                .pipe(
                    map(result => new LoadFilesSuccess(result)),
                    catchError(error => of(new LoadFilesFailure(error)))
                )
        )
    );

    // load files failure effect
    @Effect()
    loadFilesFailure$ = this.actions$.pipe(
        ofType<LoadFilesFailure>(BackendActionTypes.LoadFilesFailure),
        map((error) => new APIError(error))
    );

    // get file content effect
    @Effect()
    getFileContent$ = this.actions$.pipe(
        ofType<GetFileContent>(BackendActionTypes.GetFileContent),
        withLatestFrom(this.store.pipe(select(appStore.getAppState))),
        switchMap(([action, state]) => {
          const file = action.payload;
          const user = state.auth.currentUser;
          return this.fileManagementService.getFileContent(user.repoName, user.branchName, file.applicationName, file.fileName)
              .pipe(
                  map(data => new GetFileContentSuccess({file: {...file, config: data, originalConfig: data }})),
                  catchError(error => of(new GetFileContentFailure(error)))
              );
        })
    );

    // get file failure effect
    @Effect()
    getFileContentFailure$ = this.actions$.pipe(
        ofType<GetFileContentFailure>(BackendActionTypes.GetFileContentFailure),
        map((error) => new APIError(error))
    );

    // save draft success effect
    @Effect({ dispatch: false })
    saveDraft$ = this.actions$.pipe(
        ofType<SaveDraft>(BackendActionTypes.SaveDraft),
        tap((action) => {
          if (action.payload.redirect) {
            return this.router.navigate(['/dashboard']);
          }
        })
    );

    // commit change success effect
    @Effect({ dispatch: false })
    commitChangesSuccess$ = this.actions$.pipe(
        ofType<CommitChangesSuccess>(BackendActionTypes.CommitChangesSuccess),
        tap((action) => {
          if (action.payload.fromEditor) {
            return this.router.navigate(['/dashboard']);
          }
        })
    );

    // commit changes effect
    @Effect()
    commitChanges$ = this.actions$.pipe(
      ofType<CommitChanges>(BackendActionTypes.CommitChanges),
      withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
      switchMap(([action, user]) => {

        const files = action.payload.files;
        const commitMessage = action.payload.message;
        const fromEditor = action.payload.fromEditor;
        return this.fileManagementService.commitFiles(user.repoName, user.branchName, files, commitMessage)
          .pipe(
              map((result) => {
                files.forEach(file => {
                  _.assign(file, _.find(result, _.pick(file, ['fileName', 'applicationName'])));
                });
                return new CommitChangesSuccess({files, fromEditor});
              }),
              catchError(error => of(new CommitChangesFailure({error, files, commitMessage, fromEditor})))
          );
      })
    );

    // commit files failure effect
    @Effect()
    commitChangesFailure$ = this.actions$.pipe(
        ofType<CommitChangesFailure>(BackendActionTypes.CommitChangesFailure),
        switchMap((action) => {
          if (action.payload.error.status === 409) {
            this.dialog.open(ConflictDialogComponent, {
                data: {
                    fromEditor: action.payload.fromEditor,
                    draftFiles : action.payload.files,
                    conflictFiles: action.payload.error.error.conflictFiles,
                    commitMessage: action.payload.commitMessage
                }
            });
            return of(new AlertClosed({}));
          } else {
            return of(new APIError({payload: action.payload.error}));
          }
        })
    );

    // delete file effect
    @Effect()
    deleteFile$ = this.actions$.pipe(
        ofType<DeleteFile>(BackendActionTypes.DeleteFile),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(([action, user]) => {
            const file = action.payload;
            if (!file.timestamp) {
              // This a new draft file
              return of(new DeleteFileSuccess(file));
            }
            return this.fileManagementService.deleteFile(user.repoName, user.branchName, file.applicationName, file.fileName)
                .pipe(
                    map(() => new DeleteFileSuccess(file)),
                    catchError(error => of(new DeleteFileFailure(error)))
                );
            }
        )
    );

    // delete file success effect
    @Effect()
    deleteFileSuccess$ = this.actions$.pipe(
        ofType<DeleteFileSuccess>(BackendActionTypes.DeleteFileSuccess),
        map((action) => new Alert({
          message: `${action.payload.applicationName} / ${action.payload.fileName} deleted successfully.`,
          editorType: 'delete'}))
    );

    // delete file failure effect
    @Effect()
    deleteFileFailure$ = this.actions$.pipe(
        ofType<DeleteFileFailure>(BackendActionTypes.DeleteFileFailure),
        map((error) => new APIError(error))
    );
}
