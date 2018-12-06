import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as _ from 'lodash';

import { appPercyConfig } from 'config';

import { ConfigFile, Configuration } from 'models/config-file';

import * as appStore from '..';
import { APIError } from '../actions/common.actions';
import {
  EditorActionTypes,
  PageLoad,
  PageLoadSuccess,
  PageLoadFailure,
} from '../actions/editor.actions';
import { GetFileContentSuccess } from 'store/actions/backend.actions';
import { GetConfigFile } from 'store/reducers/backend.reducers';

import { FileManagementService } from 'services/file-management.service';

// defines the editor page related effects
@Injectable()
export class EditorEffects {
  constructor(
    private actions$: Actions,
    private store: Store<appStore.AppState>,
    private fileManagementService: FileManagementService,
  ) { }

  // handles the page load request
  @Effect()
  pageLoad$ = this.actions$.pipe(
    ofType<PageLoad>(EditorActionTypes.PageLoad),
    withLatestFrom(this.store.pipe(select(appStore.getAppState))),
    switchMap(async ([action, appState]) => {

      // Reset appPercyConfig
      _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);

      const fileName = action.payload.fileName;
      const applicationName = action.payload.applicationName;
      const principal = appState.backend.principal;

      const result = [];
      const promises = [];

      try {

        promises.push(this.fileManagementService.getEnvironments(principal, applicationName));

        if (!action.payload.editMode) {
          // Add new file, set an initial config
          const file: ConfigFile = {
            fileName,
            applicationName,
            draftConfig: new Configuration(),
            modified: true
          };
          result.push(new GetFileContentSuccess({ file, newlyCreated: true }));
        } else {
          const file = GetConfigFile(appState.backend, fileName, applicationName);

          if (file && (file.originalConfig || file.draftConfig)) { // Newly added (but uncommitted) file has only draft config
            result.push(new GetFileContentSuccess({ file }));
          } else {
            promises.push(this.fileManagementService.getFileContent(principal, file ? { ...file } : { fileName, applicationName }));
          }
        }

        const promiseResult = await Promise.all(promises);
        result.push(new PageLoadSuccess(promiseResult[0]));

        // Set app's specific percy config
        _.assign(appPercyConfig, promiseResult[0].appPercyConfig);

        if (promiseResult[1]) {
          result.push(new GetFileContentSuccess({ file: promiseResult[1] }));
        }

        return result;
      } catch (error) {
        return [new PageLoadFailure(error)];
      }
    }),
    switchMap(res => res),
  );

  // load environment failure effect
  @Effect()
  pageLoadFailure$ = this.actions$.pipe(
    ofType<PageLoadFailure>(EditorActionTypes.PageLoadFailure),
    map((action) => new APIError(action.payload))
  );
}
