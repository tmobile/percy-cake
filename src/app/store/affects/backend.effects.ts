import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as HttpErrors from 'http-errors';
import * as _ from 'lodash';

import * as appStore from '..';
import { Alert, APIError, Navigate } from '../actions/common.actions';
import {
  BackendActionTypes, Initialize, Initialized,
  SaveDraft, CommitChanges, CommitChangesSuccess, CommitChangesFailure,
  LoadFiles, LoadFilesSuccess, LoadFilesFailure,
  DeleteFile, DeleteFileFailure, DeleteFileSuccess,
  GetFileContent, GetFileContentSuccess, GetFileContentFailure,
  SaveDraftSuccess, SaveDraftFailure, Refresh, RefreshFailure, RefreshSuccess,
  CheckoutFailure, Checkout, CheckoutSuccess, MergeBranch, MergeBranchFailure, MergeBranchSuccess
} from '../actions/backend.actions';
import { FileManagementService } from 'services/file-management.service';
import { ConflictDialogComponent } from 'components/conflict-dialog/conflict-dialog.component';
import { ConfigFile } from 'models/config-file';

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
        const { branchChanged, masterChanged } = await this.fileManagementService.refresh(pricinpal);
        const result = [];

        result.push(new RefreshSuccess());
        if (branchChanged || masterChanged) {
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
      const error: any = action.payload.error;
      if (error.statusCode === 409) {
        const dialogRef = this.dialog.open(ConflictDialogComponent, {
          data: {
            conflictFiles: error.data,
          }
        });
        dialogRef.afterClosed().subscribe((resolved: ConfigFile[]) => {
          if (resolved) {
            // Add back the unconlict draft file(s)
            action.payload.files.forEach(draftFile => {
              if (!_.find(resolved, _.pick(draftFile, ['applicationName', 'fileName']))) {
                resolved.push(draftFile);
              }
            });

            this.store.dispatch(new CommitChanges({
              files: resolved,
              message: action.payload.commitMessage,
              fromEditor: action.payload.fromEditor,
              resolveConflicts: true,
            }));
          } else {
            this.store.dispatch(new LoadFiles());
          }
        });
        return of();
      } else {
        return of(new APIError(error));
      }
    })
  );

  // merge branch effect
  @Effect()
  MergeBranch$ = this.actions$.pipe(
    ofType<MergeBranch>(BackendActionTypes.MergeBranch),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, pricinpal]) => {
      const srcBranch = action.payload.srcBranch;
      const targetBranch = action.payload.targetBranch;

      let diff = action.payload.diff;
      try {
        const results = [];

        if (!diff) {
          await this.fileManagementService.refresh(pricinpal);
          const { toSave, toDelete, conflictFiles } =
            await this.fileManagementService.branchDiff(pricinpal, srcBranch, targetBranch);
          diff = { toSave, toDelete };

          if (conflictFiles.length) {
            const error = new HttpErrors.Conflict('Branch conflict');
            error.data = {
              diff,
              conflictFiles,
              srcBranch,
              targetBranch,
            };
            throw error;
          }
        }

        if (diff.toSave.length || diff.toDelete.length) {
          await this.fileManagementService.mergeBranch(pricinpal, srcBranch, targetBranch, diff);
        }

        results.push(new MergeBranchSuccess());
        results.push(new LoadFiles()); // reload files
        return results;
      } catch (error) {
        return [new MergeBranchFailure(error)];
      }
    }),
    switchMap(res => res)
  );

  // merge branch failure effect
  @Effect()
  MergeBranchFailure$ = this.actions$.pipe(
    ofType<MergeBranchFailure>(BackendActionTypes.MergeBranchFailure),
    switchMap((action) => {
      const error: any = action.payload;

      if (error.statusCode === 409 && error.data) {
        const dialogRef = this.dialog.open(ConflictDialogComponent, {
          data: error.data
        });

        dialogRef.afterClosed().subscribe((resolved: ConfigFile[]) => {
          if (resolved) {
            // Add back the unconlict file(s)
            resolved.forEach(res => {
              error.data.diff.toSave.push(res);
            });
            this.store.dispatch(new MergeBranch({
              srcBranch: error.data.srcBranch,
              targetBranch: error.data.targetBranch,
              diff: error.data.diff
            }));
          } else {
            this.store.dispatch(new LoadFiles());
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
        await this.fileManagementService.deleteFile(user, file);

        const result = [];
        result.push(new DeleteFileSuccess(file)),
          result.push(new Alert({
            message: `${file.applicationName}/${file.fileName} is deleted successfully.`,
            alertType: 'delete'
          }));

        result.push(new LoadFiles());
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

  // checkout branch effect
  @Effect()
  checkout$ = this.actions$.pipe(
    ofType<Checkout>(BackendActionTypes.Checkout),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, pricinpal]) => {
      try {
        await this.fileManagementService.checkoutBranch(pricinpal, action.payload.type, action.payload.branch);
        const result = [];

        result.push(new CheckoutSuccess({ branch: action.payload.branch }));
        result.push(new LoadFiles());
        return result;
      } catch (error) {
        return [new CheckoutFailure(error)];
      }
    }),
    switchMap(res => res),
  );

  // checkout branch failure effect
  @Effect()
  checkoutFailure$ = this.actions$.pipe(
    ofType<CheckoutFailure>(BackendActionTypes.CheckoutFailure),
    map((action) => new APIError(action.payload))
  );
}
