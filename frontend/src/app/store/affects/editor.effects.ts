import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, exhaustMap, catchError, withLatestFrom, switchMap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from 'store';
import { SaveDraft, GetFileContent, GetFileContentSuccess } from 'store/actions/backend.actions';
import { APIError } from 'store/actions/common.actions';
import {
    EditorActionTypes,
    PageLoad,
    PageLoadSuccess,
    PageLoadFailure,
    SaveFile,
    NodeSelectedSuccess,
    NodeSelected,
    ConfigurationChange,
} from 'store/actions/editor.actions';
import { GetConfigFile } from 'store/reducers/backend.reducers';
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
            const environments = await this.fileManagementService.getEnvironments(user.repoPath, action.payload.appName);
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
            if (state.editor.inEnvMode) {
              return of(new ConfigurationChange({
                default: { $type: 'array', $value: [] }
              }));
            }
            return of(new ConfigurationChange({
              default: { $type: 'object' },
              environments: { $type: 'object' }
            }));
          }

          const file = GetConfigFile(state.backend, state.editor.fileName, state.editor.appName);

          if (file && (file.originalConfig || !file.timestamp)) { // No timestamp means uncommitted (but draft saved) new file
            return of(new GetFileContentSuccess(file));
          }
          return of(new GetFileContent(file ? file : {fileName, applicationName}));
        })
    );

    // save file effect
    @Effect()
    saveFile$ = this.actions$.pipe(
        ofType<SaveFile>(EditorActionTypes.SaveFile),
        withLatestFrom(this.store.pipe(select(appStore.editorState))),
        switchMap(([action, editorState]) => {
            const draftConfig = editorState.configuration;
            if (editorState.inEditMode) {
              const file: ConfigFile = {
                fileName: editorState.fileName,
                applicationName: editorState.appName,
                draftConfig,
                modified: !_.isEqual(editorState.originalConfiguration, draftConfig),
              };
              return of(new SaveDraft({file, redirect: action.payload.redirectToDashboard}));
            } else {
              const file: ConfigFile = {
                fileName: editorState.fileName,
                applicationName: editorState.appName,
                draftConfig,
                modified: true,
              };
              return of(new SaveDraft({file, redirect: action.payload.redirectToDashboard}));
            }
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
