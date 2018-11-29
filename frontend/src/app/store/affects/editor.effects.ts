import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, withLatestFrom, switchMap } from 'rxjs/operators';

import * as appStore from '..';
import { GetFileContentSuccess, GetFileContent } from '../actions/backend.actions';
import { APIError } from '../actions/common.actions';
import {
    EditorActionTypes,
    PageLoad,
    PageLoadSuccess,
    PageLoadFailure,
} from '../actions/editor.actions';
import { GetConfigFile } from '../reducers/backend.reducers';
import { ConfigFile } from 'models/config-file';
import { UtilService } from 'services/util.service';
import { FileManagementService } from 'services/file-management.service';

// defines the editor page related effects
@Injectable()
export class EditorEffects {
    constructor(
        private actions$: Actions,
        private store: Store<appStore.AppState>,
        private fileManagementService: FileManagementService,
        private utilService: UtilService,
    ) { }

    // handles the page load request
    @Effect()
    pageLoad$ = this.actions$.pipe(
        ofType<PageLoad>(EditorActionTypes.PageLoad),
        withLatestFrom(this.store.pipe(select(appStore.getCurrentUser))),
        switchMap(async ([action, user]) => {
          try {
            const environments = await this.fileManagementService.getEnvironments(user, action.payload.appName);
            return new PageLoadSuccess({ environments });
          } catch (error) {
            return new PageLoadFailure(error);
          }
        })
    );

    // page load success effect
    @Effect()
    pageLoadSuccess$ = this.actions$.pipe(
        ofType<PageLoadSuccess>(EditorActionTypes.PageLoadSuccess),
        withLatestFrom(this.store.pipe(select(appStore.getAppState))),
        switchMap(([action, state]) => {
          const fileName = state.editor.fileName;
          const applicationName = state.editor.appName;

          if (!state.editor.inEditMode) {
            // Add new file, set an initial config
            const file: ConfigFile = {
              fileName,
              applicationName,
              draftConfig: {
                default: { $type: 'object' },
                environments: { $type: 'object' }
              },
              modified: true
            };
            return of(new GetFileContentSuccess({file, newlyCreated: true}));
          }

          const file = GetConfigFile(state.backend, state.editor.fileName, state.editor.appName);

          if (file && (file.originalConfig || file.draftConfig)) { // Newly added (but uncommitted) file has only draft config
            return of(new GetFileContentSuccess({file}));
          }
          return of(new GetFileContent(file ? file : {fileName, applicationName}));
        })
    );

    // load environment failure effect
    @Effect()
    pageLoadFailure$ = this.actions$.pipe(
        ofType<PageLoadFailure>(EditorActionTypes.PageLoadFailure),
        map((action) => new APIError(action.payload))
    );
}
