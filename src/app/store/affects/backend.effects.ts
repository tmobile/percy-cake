import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as boom from 'boom';

import * as appStore from '..';
import { Alert, APIError, Navigate } from '../actions/common.actions';
import {
  BackendActionTypes, Initialize, Initialized,
  SaveDraft, CommitChanges, CommitChangesSuccess, CommitChangesFailure,
  LoadFiles, LoadFilesSuccess, LoadFilesFailure,
  DeleteFile, DeleteFileFailure, DeleteFileSuccess,
  GetFileContent, GetFileContentSuccess, GetFileContentFailure,
  SaveDraftSuccess, SaveDraftFailure, Refresh, RefreshFailure, RefreshSuccess
} from '../actions/backend.actions';
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

  // initialize redirect effect
  @Effect()
  initialize$ = this.actions$.pipe(
    ofType<Initialize>(BackendActionTypes.Initialize),
    map(() => new Navigate(['/init']))
  );

  // login success effect
  @Effect()
  initialized$ = this.actions$.pipe(
    ofType<Initialized>(BackendActionTypes.Initialized),
    withLatestFrom(this.store.pipe(select(appStore.backendState))),
    map(([_action, backendState]) => new Navigate([backendState.redirectUrl || '/dashboard']))
  );

  // load files effect
  @Effect()
  loadFiles$ = this.actions$.pipe(
    ofType<LoadFiles>(BackendActionTypes.LoadFiles, BackendActionTypes.Initialized, BackendActionTypes.DeleteFileFailure),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([_action, user]) => {
      try {
        const result = await this.fileManagementService.getFiles(user);
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

  // refresh repo effect
  @Effect()
  refreshFiles$ = this.actions$.pipe(
    ofType<Refresh>(BackendActionTypes.Refresh),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([_action, pricinpal]) => {

      try {
        const { changed } = await this.fileManagementService.refresh(pricinpal);
        const result = [];

        result.push(new RefreshSuccess());
        if (changed) {
          result.push(new LoadFiles());
        }
        return result;
      } catch (error) {
        return [new RefreshFailure(error)];
      }
    }),
    switchMap(res => res),
  );

  // refresh failure effect
  @Effect()
  refreshFailure$ = this.actions$.pipe(
    ofType<RefreshFailure>(BackendActionTypes.RefreshFailure),
    map((action) => new APIError(action.payload))
  );

  // get file content effect
  @Effect()
  getFileContent$ = this.actions$.pipe(
    ofType<GetFileContent>(BackendActionTypes.GetFileContent),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, user]) => {
      try {
        const result = await this.fileManagementService.getFileContent(user, action.payload);
        return new GetFileContentSuccess({ file: result });
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
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, user]) => {
      const file = action.payload.file;
      try {
        const saved = await this.fileManagementService.saveDraft(user, file);
        const result = [];
        result.push(new SaveDraftSuccess(saved));
        if (action.payload.redirect) {
          result.push(new Navigate(['/dashboard']));
        }
        return result;
      } catch (error) {
        return [new SaveDraftFailure(error)];
      }
    }),
    switchMap(res => res),
  );

  // save draft failure effect
  @Effect()
  saveDraftFailure$ = this.actions$.pipe(
    ofType<SaveDraftFailure>(BackendActionTypes.SaveDraftFailure),
    map((action) => new APIError(action.payload))
  );

  // commit changes effect
  @Effect()
  commitChanges$ = this.actions$.pipe(
    ofType<CommitChanges>(BackendActionTypes.CommitChanges),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, user]) => {

      let files = action.payload.files;
      const commitMessage = action.payload.message;
      const fromEditor = action.payload.fromEditor;

      try {
        if (action.payload.resolveConflicts) {
          files = await this.fileManagementService.resovelConflicts(user, files, commitMessage);
        } else {
          files = await this.fileManagementService.commitFiles(user, files, commitMessage);
        }
        const results = [];
        results.push(new CommitChangesSuccess({ files, fromEditor }));
        results.push(new LoadFiles()); // reload files
        if (fromEditor) {
          results.push(new Navigate(['/dashboard']));
        }
        return results;
      } catch (error) {
        return [new CommitChangesFailure({ error, files, commitMessage, fromEditor })];
      }
    }),
    switchMap(res => res)
  );

  // commit files failure effect
  @Effect()
  commitChangesFailure$ = this.actions$.pipe(
    ofType<CommitChangesFailure>(BackendActionTypes.CommitChangesFailure),
    switchMap((action) => {
      const error = boom.boomify(action.payload.error);
      if (error.output.statusCode === 409) {
        this.dialog.open(ConflictDialogComponent, {
          data: {
            fromEditor: action.payload.fromEditor,
            draftFiles: action.payload.files,
            conflictFiles: error.data,
            commitMessage: action.payload.commitMessage
          }
        });
        return of();
      } else {
        return of(new APIError(error));
      }
    })
  );

  // delete file effect
  @Effect()
  deleteFile$ = this.actions$.pipe(
    ofType<DeleteFile>(BackendActionTypes.DeleteFile),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, user]) => {
      const file = action.payload;
      try {
        const gitPulled = await this.fileManagementService.deleteFile(user, file);

        const result = [];
        result.push(new DeleteFileSuccess(file)),
          result.push(new Alert({
            message: `${file.applicationName}/${file.fileName} is deleted successfully.`,
            alertType: 'delete'
          }));

        if (gitPulled) {
          result.push(new LoadFiles());
        }
        return result;
      } catch (error) {
        return [new DeleteFileFailure(error)];
      }
    }),
    switchMap(res => res)
  );

  // delete file failure effect
  @Effect()
  deleteFileFailure$ = this.actions$.pipe(
    ofType<DeleteFileFailure>(BackendActionTypes.DeleteFileFailure),
    map((action) => new APIError(action.payload))
  );
}
