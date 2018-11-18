import * as _ from 'lodash';

import { Configuration } from '../../models/config-file';
import { TreeNode } from '../../models/tree-node';
import { ConfigProperty } from '../../models/config-property';

import { BackendActionsUnion, BackendActionTypes } from '../actions/backend.actions';
import { EditorActionTypes, EditorActionsUnion } from '../actions/editor.actions';

export interface State {
    error: any;
    isCommitting: boolean;
    environments: Array<string>;
    appName: string;
    fileName: string;
    inEditMode: boolean;
    inEnvMode: boolean;
    configuration: Configuration; // In-edit config
    draftConfiguration: Configuration; // Saved draft config
    originalConfiguration: Configuration; // Original config from server
    showAsCode: boolean;
    previewCode: string;
    showAsCompiledYAMLEnvironment: string;
    selectedNode: TreeNode;
    currentAddEditProperty: any;
    selectedConfigProperty: ConfigProperty;
    isPageDirty: boolean;
}

export const initialState: State = {
    error: null,
    isCommitting: false,
    appName: null,
    fileName: null,
    environments: [],
    inEditMode: false,
    inEnvMode: false,
    configuration: null,
    draftConfiguration: null,
    originalConfiguration: null,
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

        case EditorActionTypes.PageLoadFailure: {
            return {
                ...state,
                error: action.payload.message,
            };
        }

        case BackendActionTypes.GetFileContentSuccess: {
          const originalConfiguration = action.payload.originalConfig;
          const draftConfiguration = action.payload.draftConfig || originalConfiguration;
          const configuration = draftConfiguration;
          return {
              ...state,
              configuration,
              draftConfiguration,
              originalConfiguration,
              isPageDirty: false
          };
        }

        case BackendActionTypes.GetFileContentFailure: {
          return {
              ...state,
              error: action.payload.message,
          };
        }

        case EditorActionTypes.ConfigurationChange: {
            const configuration = {...action.payload};

            return {
                ...state,
                configuration,
                isPageDirty: !_.isEqual(state.draftConfiguration, configuration)
            };
        }

        case EditorActionTypes.ViewCompiledYAML: {
            return {
                ...state,
                showAsCompiledYAMLEnvironment: action.payload.environment,
            };
        }
        case EditorActionTypes.ViewCompiledYAMLSuccess: {
            return {
                ...state,
                showAsCode: false,
                selectedNode: null,
                selectedConfigProperty: null,
                currentAddEditProperty: null,
                previewCode: action.payload.compiledYAML,
            };
        }

        case EditorActionTypes.ChangeFileName: {
          return {
              ...state,
              fileName: action.payload,
          };
        }

        case EditorActionTypes.SaveFile: {
          return {
              ...state,
              draftConfiguration: state.configuration,
              isPageDirty: false,
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

            return {
                ...state,
                draftConfiguration: state.configuration,
                originalConfiguration: state.configuration,
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

export const getConfiguration = (state: State) => state.configuration;
export const getError = (state: State) => state.error;
export const isCommitting = (state: State) => state.isCommitting;
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




