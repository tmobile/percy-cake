/**
 *   Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import * as _ from 'lodash';

import { Configuration, ConfigFile } from 'models/config-file';

import { BackendActionsUnion, BackendActionTypes } from '../actions/backend.actions';
import { EditorActionTypes, EditorActionsUnion } from '../actions/editor.actions';

export interface State {
  isCommitting: boolean;
  isSaving: boolean;
  environments: Array<string>;
  editMode: boolean;
  configFile: ConfigFile;
  configuration: Configuration; // In-edit config, not saved as draft
  isPageDirty: boolean;
}

export const initialState: State = {
  isCommitting: false,
  isSaving: false,
  environments: null,
  editMode: false,
  configFile: null,
  configuration: null,
  isPageDirty: false,
};

export function reducer(state = initialState, action: EditorActionsUnion | BackendActionsUnion): State {
  switch (action.type) {
    case EditorActionTypes.PageRestore: {
      return {
        ...action.payload
      };
    }

    case EditorActionTypes.PageLoad: {
      return {
        ...initialState,
        editMode: action.payload.editMode
      };
    }

    case EditorActionTypes.PageLoadSuccess: {
      return {
        ...state,
        environments: action.payload.environments,
      };
    }

    case BackendActionTypes.GetFileContentSuccess: {
      const { file } = action.payload;
      return {
        ...state,
        configFile: { ...file },
        configuration: _.cloneDeep(file.draftConfig || file.originalConfig),
        isPageDirty: !state.editMode
      };
    }

    case EditorActionTypes.ConfigurationChange: {
      const configuration = action.payload;
      const file = state.configFile;
      return {
        ...state,
        configFile: { ...file, modified: !_.isEqual(file.originalConfig, configuration) },
        configuration,
        isPageDirty: !state.editMode || !_.isEqual(file.draftConfig || file.originalConfig, configuration)
      };
    }

    case BackendActionTypes.SaveDraft: {
      return {
        ...state,
        isSaving: true,
      };
    }

    case BackendActionTypes.SaveDraftSuccess: {
      const file = action.payload;
      return {
        ...state,
        configFile: { ...file, draftConfig: _.cloneDeep(file.draftConfig) },
        configuration: file.draftConfig,
        isPageDirty: false,
        isSaving: false,
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
        configFile: { ...file, originalConfig: _.cloneDeep(file.originalConfig) },
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
export const getIsPageDirty = (state: State) => state.isPageDirty;
