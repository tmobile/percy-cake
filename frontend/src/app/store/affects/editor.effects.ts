import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, exhaustMap, withLatestFrom, switchMap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';

import * as appStore from '..';
import { GetFileContentSuccess, GetFileContent } from '../actions/backend.actions';
import { APIError } from '../actions/common.actions';
import {
    EditorActionTypes,
    PageLoad,
    PageLoadSuccess,
    PageLoadFailure,
    NodeSelectedSuccess,
    NodeSelected,
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
            const file: ConfigFile = { fileName, applicationName, modified: true };
            // Add new file, set an initial config
            if (state.editor.inEnvMode) {
              file.draftConfig = {default: { $type: 'array', $value: [] }};
              return of(new GetFileContentSuccess({file, newlyCreated: true}));
            }
            file.draftConfig = {
              default: { $type: 'object' },
              environments: { $type: 'object' }
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

    // node selected effect to show detail
    @Effect()
    nodeSelected$ = this.actions$.pipe(
        ofType<NodeSelected>(EditorActionTypes.NodeSelected),
        map(action => action.payload),
        exhaustMap(data => {
            if (!data.node.isLeaf()) {
                const compiledYAML = this.utilService.convertJsonToYaml({[data.node.key]: data.node.jsonValue});
                return of(new NodeSelectedSuccess({ compiledYAML, configProperty: null }));
            } else {
                const configProperty = data.node.toConfigProperty();
                return of(new NodeSelectedSuccess({ compiledYAML: null, configProperty }));
            }
        })
    );

    // load environment failure effect
    @Effect()
    pageLoadFailure$ = this.actions$.pipe(
        ofType<PageLoadFailure>(EditorActionTypes.PageLoadFailure),
        map((action) => new APIError(action.payload))
    );
}
