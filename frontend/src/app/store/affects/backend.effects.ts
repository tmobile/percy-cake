import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as _ from 'lodash';

import * as appStore from 'store';
import { Alert, APIError, Navigate } from 'store/actions/common.actions';
import {
    BackendActionTypes,
    SaveDraft, CommitChanges, CommitChangesSuccess, CommitChangesFailure,
    LoadFiles, LoadFilesSuccess, LoadFilesFailure,
    DeleteFile, DeleteFileFailure, DeleteFileSuccess,
    GetFileContent, GetFileContentSuccess, GetFileContentFailure
} from 'store/actions/backend.actions';
import { FileManagementService } from 'services/file-management.service';
import { ConflictDialogComponent } from 'components/conflict-dialog/conflict-dialog.component';

// defines the backend related effects
@Injectable()
export class BackendEffects {
    constructor(
        private actions$: Actions,
        private dialog: MatDialog,
        private fileManagementService: FileManagementService,
        private store: Store<appStore.AppState>
    ) { }

    // load files effect
    @Effect()
    loadFiles$ = this.actions$.pipe(
        ofType<LoadFiles>(BackendActionTypes.LoadFiles, BackendActionTypes.DeleteFileFailure),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(async ([action, user]) => {
          try {
            const result = await this.fileManagementService.getFiles(user.repoPath, user.branchName);
            return new LoadFilesSuccess(result);
          } catch (error) {
            return new LoadFilesFailure(error);
          }
        })
    );

    // load files failure effect
    @Effect()
    loadFilesFailure$ = this.actions$.pipe(
        ofType<LoadFilesFailure>(BackendActionTypes.LoadFilesFailure),
        map((action) => new APIError(action.payload))
    );

    // get file content effect
    @Effect()
    getFileContent$ = this.actions$.pipe(
        ofType<GetFileContent>(BackendActionTypes.GetFileContent),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(async ([action, user]) => {
          const file = action.payload;
          try {
            const result = await this.fileManagementService.getFileContent(user.repoPath, file.applicationName, file.fileName);
            return new GetFileContentSuccess({...file, originalConfig: result }); // set the original config from server
          } catch (error) {
            return new GetFileContentFailure(error);
          }
        })
    );

    // get file failure effect
    @Effect()
    getFileContentFailure$ = this.actions$.pipe(
        ofType<GetFileContentFailure>(BackendActionTypes.GetFileContentFailure),
        map((action) => new APIError(action.payload))
    );

    // save draft success effect
    @Effect()
    saveDraft$ = this.actions$.pipe(
        ofType<SaveDraft>(BackendActionTypes.SaveDraft),
        switchMap((action) => {
          if (action.payload.redirect) {
            return of(new Navigate(['/dashboard']));
          }
          return of();
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

    // commit change success effect
    @Effect()
    commitChangesSuccess$ = this.actions$.pipe(
        ofType<CommitChangesSuccess>(BackendActionTypes.CommitChangesSuccess),
        switchMap((action) => {
          const results = [];
          results.push(new LoadFiles()); // reload files
          if (action.payload.fromEditor) {
            results.push(new Navigate(['/dashboard']));
          }
          return results;
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
            return of();
          } else {
            return of(new APIError(action.payload.error));
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
        switchMap((action) => {
          const results = [];
          if (action.payload.timestamp) {
            // reload files
            results.push(new LoadFiles());
          }
          results.push(new Alert({
            message: `${action.payload.applicationName} / ${action.payload.fileName} deleted successfully.`,
            alertType: 'delete'}));
          return results;
        })
    );

    // delete file failure effect
    @Effect()
    deleteFileFailure$ = this.actions$.pipe(
        ofType<DeleteFileFailure>(BackendActionTypes.DeleteFileFailure),
        map((action) => new APIError(action.payload))
    );
}
