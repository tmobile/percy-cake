import * as _ from 'lodash';

import { Configuration, ConfigFile } from 'models/config-file';
import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';

import { BackendActionsUnion, BackendActionTypes } from '../actions/backend.actions';
import { EditorActionTypes, EditorActionsUnion } from '../actions/editor.actions';

export interface State {
    isCommitting: boolean;
    isSaving: boolean;
    environments: Array<string>;
    appName: string;
    fileName: string;
    inEditMode: boolean;
    inEnvMode: boolean;
    configFile: ConfigFile;
    configuration: Configuration; // In-edit config
    showAsCode: boolean;
    previewCode: string;
    showAsCompiledYAMLEnvironment: string;
    selectedNode: TreeNode;
    currentAddEditProperty: any;
    selectedConfigProperty: ConfigProperty;
    isPageDirty: boolean;
}

export const initialState: State = {
    isCommitting: false,
    isSaving: false,
    appName: null,
    fileName: null,
    environments: [],
    inEditMode: false,
    inEnvMode: false,
    configFile: null,
    configuration: null,
    showAsCode: false,
    previewCode: null,
    showAsCompiledYAMLEnvironment: null,
    selectedNode: null,
    currentAddEditProperty: null,
    selectedConfigProperty: null,
    isPageDirty: false,
};

const cancelRightPanel = {
    showAsCode: false,
    previewCode: null,
    showAsCompiledYAMLEnvironment: null,
    selectedNode: null,
    selectedConfigProperty: null,
    currentAddEditProperty: null,
};

export function reducer(state = initialState, action: EditorActionsUnion | BackendActionsUnion): State {
    switch (action.type) {
        case EditorActionTypes.PageLoad: {
            return {
                ...initialState,
                ...action.payload
            };
        }

        case EditorActionTypes.PageLoadSuccess: {
            return {
                ...state,
                environments: action.payload.environments,
            };
        }

        case BackendActionTypes.GetFileContentSuccess: {
          const {file} = action.payload;
          const configuration = file.draftConfig || file.originalConfig;
          return {
              ...state,
              configFile: {...file},
              configuration,
              isPageDirty: !state.inEditMode
          };
        }

        case EditorActionTypes.ConfigurationChange: {
            const configuration = {...action.payload};
            const file = state.configFile;

            return {
                ...state,
                configFile: {...file, modified: !_.isEqual(file.originalConfig, configuration)},
                configuration,
                isPageDirty: !state.inEditMode || !_.isEqual(file.draftConfig || file.originalConfig, configuration)
            };
        }

        case EditorActionTypes.ViewCompiledYAMLSuccess: {
            return {
                ...state,
                showAsCode: false,
                selectedNode: null,
                selectedConfigProperty: null,
                currentAddEditProperty: null,
                showAsCompiledYAMLEnvironment: action.payload.environment,
                previewCode: action.payload.compiledYAML,
            };
        }

        case EditorActionTypes.ChangeFileName: {
          return {
              ...state,
              fileName: action.payload,
          };
        }

        case BackendActionTypes.SaveDraft: {
          return {
              ...state,
              isSaving: true,
          };
        }

        case BackendActionTypes.SaveDraftSuccess: {
          return {
              ...state,
              configFile: {...action.payload},
              isPageDirty: false,
          };
        }

        case BackendActionTypes.SaveDraftFailure: {
          return {
              ...state,
              isSaving: false,
          };
        }

        case BackendActionTypes.CommitChanges: {
            if (!action.payload.fromEditor) {
              return state;
            }
            return {
                ...state,
                isCommitting: true
            };
        }

        case BackendActionTypes.CommitChangesSuccess: {
            if (!action.payload.fromEditor) {
              return state;
            }

            const file = action.payload.files[0];
            return {
                ...state,
                configFile: {...file},
                configuration: file.originalConfig,
                isCommitting: false,
                isPageDirty: false,
            };
        }

        case BackendActionTypes.CommitChangesFailure: {
            if (!action.payload.fromEditor) {
              return state;
            }

            return {
                ...state,
                isCommitting: false
            };
        }

        case EditorActionTypes.OpenAddEditProperty: {
            return {
                ...state,
                showAsCode: false,
                previewCode: null,
                showAsCompiledYAMLEnvironment: null,
                selectedNode: null,
                selectedConfigProperty: null,
                currentAddEditProperty: {
                    options: action.payload.options,
                },
            };
        }

        case EditorActionTypes.CancelAddEditProperty: {

            return {
                ...state,
                ...cancelRightPanel
            };
        }

        case EditorActionTypes.SaveAddEditProperty: {
            return {
                ...state,
                ...cancelRightPanel
            };
        }
        case EditorActionTypes.NodeSelected: {
            return {
                ...state,
                previewCode: null,
                showAsCompiledYAMLEnvironment: null,
                selectedConfigProperty: null,
                currentAddEditProperty: null,
                selectedNode: action.payload.node,
                showAsCode: !action.payload.node.isLeaf(),
            };
        }

        case EditorActionTypes.NodeSelectedSuccess: {
            return {
                ...state,
                previewCode: action.payload.compiledYAML,
                selectedConfigProperty: action.payload.configProperty
            };
        }

        default: {
            return state;
        }
    }
}

export const getConfigFile = (state: State) => state.configFile;
export const getConfiguration = (state: State) => state.configuration;
export const isCommitting = (state: State) => state.isCommitting;
export const isSaving = (state: State) => state.isSaving;
export const getEnvironments = (state: State) => state.environments;
export const getMode = (state: State) => state.inEditMode;
export const getFilePath = (state: State) => state.fileName;
export const getShowAsCode = (state: State) => state.showAsCode;
export const getPreviewCode = (state: State) => state.previewCode;
export const getShowAsCompiledYAMLEnvironment = (state: State) => state.showAsCompiledYAMLEnvironment;
export const getSelectedNode = (state: State) => state.selectedNode;
export const getCurrentAddEditProperty = (state: State) => state.currentAddEditProperty;
export const getSelectedConfigProperty = (state: State) => state.selectedConfigProperty;
export const getIsPageDirty = (state: State) => state.isPageDirty;
