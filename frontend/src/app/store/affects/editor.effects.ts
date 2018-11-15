import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, exhaustMap, catchError, withLatestFrom, switchMap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';
import * as _ from 'lodash';

import {
    EditorActionTypes,
    PageLoad,
    PageLoadSuccess,
    PageLoadFailure,
    ViewCompiledYAML,
    ViewCompiledYAMLSuccess,
    SaveFile,
    NodeSelectedSuccess,
    NodeSelected,
} from '../actions/editor.actions';
import { GetFileContent, GetFileContentSuccess } from '../actions/backend.actions';
import { SaveDraft } from '../actions/backend.actions';
import { GetConfigFile } from '../reducers/backend.reducers';
import { ConfigFile } from '../../models/config-file';
import { FileManagementService } from '../../services/file-management.service';
import * as appStore from '..';
import { UtilService } from '../../services/util.service';
import { Alert, APIError } from '../actions/common.actions';

// defines the editor page related effects
@Injectable()
export class ConfigFileAddEditEffects {
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
        switchMap(([action, user]) =>
            this.fileManagementService.getEnvironments(user.repoName, user.branchName, action.payload.appName)
                .pipe(
                    map(environments => {
                        return new PageLoadSuccess({environments});
                    }),
                    catchError(error => of(new PageLoadFailure(error)))
                )
        )
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
            if (state.editor.inEnvMode) {
              return of(new GetFileContentSuccess({
                fileName,
                applicationName,
                config: {
                  default: { $type: 'array', $value: [] }
                },
              }));
            }
            return of(new GetFileContentSuccess({
              fileName,
              applicationName,
              config: {
                default: { $type: 'object' },
                environments: { $type: 'object' }
              },
            }));
          }

          const file = GetConfigFile(state.backend, state.editor.fileName, state.editor.appName);

          if (file && file.config) {
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
            if (editorState.inEditMode) {
              const file: ConfigFile = {
                fileName: editorState.fileName,
                applicationName: editorState.appName,
                config: editorState.configuration,
                originalConfig: editorState.originalConfiguration,
                modified: !_.isEqual(editorState.originalConfiguration, editorState.configuration),
              };
              return of(new SaveDraft({file, redirect: action.payload.redirectToDashboard}));
            } else {
              const file: ConfigFile = {
                fileName: editorState.fileName,
                applicationName: editorState.appName,
                config: editorState.configuration,
                originalConfig: null,
                modified: true,
              };
              return of(new SaveDraft({file, redirect: action.payload.redirectToDashboard}));
            }
        })
    );

    // view compiled YAML effect
    @Effect()
    viewCompiledYaml$ = this.actions$.pipe(
        ofType<ViewCompiledYAML>(EditorActionTypes.ViewCompiledYAML),
        withLatestFrom(this.store.pipe(select(appStore.getConfiguration))),
        switchMap(([action, config]) => {
            const env = action.payload.environment;
            const mergeStack = [];

            let envNode = config.environments[env] || {};
            while (envNode) {
              const shallowCopy = {...envNode};
              const inherits = shallowCopy.inherits;
              delete shallowCopy.inherits;
              mergeStack.unshift({[env]: shallowCopy});
              if (inherits) {
                const inheritEnv = inherits.$value;
                if (inheritEnv === env) {
                  return of(new Alert({ message: 'Cylic env inherits detected!', editorType: 'error' }));
                }
                envNode = config.environments[inheritEnv];
              } else {
                break;
              }
            }

            mergeStack.unshift({[env]: { ...config.default }});

            let merged = {};
            mergeStack.forEach(m => {
              merged = _.mergeWith(merged, m, (dst, src) => {
                if (_.isArray(dst)) {
                  // Copy array instead of merge
                  return src;
                }
              });
            });

            const compiledYAML = this.utilService.convertJsonToYaml(merged);
            return of(new ViewCompiledYAMLSuccess({ compiledYAML }));
        }),
    );

    // node selected effect to show detail
    @Effect()
    nodeSelected$ = this.actions$.pipe(
        ofType<NodeSelected>(EditorActionTypes.NodeSelected),
        map(action => action.payload),
        exhaustMap(data => {
            if (!data.node.isLeaf()) {
                const compiledYAML = this.utilService.convertJsonToYaml(data.node.jsonValue);
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
        map((error) => new APIError(error))
    );
}
