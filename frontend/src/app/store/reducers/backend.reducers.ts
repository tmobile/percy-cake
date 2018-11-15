import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { ConfigFile } from '../../models/config-file';
import { DashboardActionsUnion, BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';
import { AuthActionTypes } from '../actions/auth.actions';

export interface ConfigFiles extends EntityState<ConfigFile> {}

export interface State {
    applications: string[];
    files: ConfigFiles;
    redirectUrl: string;
    initialized: boolean;
}

const ConfigFileAdapter: EntityAdapter<ConfigFile> = createEntityAdapter<ConfigFile>({
  selectId: (file) => `${file.applicationName}/${file.fileName}`,
});

export const GetConfigFile = (state: State, fileName: string, applicationName: string) => {
  return ConfigFileAdapter.getSelectors().selectEntities(state.files)
    [ConfigFileAdapter.selectId({ fileName, applicationName}) + ''];
};

export const initialState: State = {
    applications: [],
    files: ConfigFileAdapter.getInitialState(),
    redirectUrl: null,
    initialized: false,
};

export function reducer(state = initialState, action: DashboardActionsUnion): State {
    switch (action.type) {

        case BackendActionTypes.EntryRedirect: {
            return {
                ...state,
                redirectUrl: action.payload.redirectUrl
            };
        }

        case BackendActionTypes.Initialized: {
            return {
                ...state,
                initialized: true
            };
        }

        case BackendActionTypes.ListApplicationsSuccess: {
            return {
                ...state,
                applications: action.payload
            };
        }

        case BackendActionTypes.LoadFilesSuccess: {
            return {
                ...state,
                files: ConfigFileAdapter.upsertMany(action.payload, state.files)
            };
        }

        case BackendActionTypes.GetFileContentSuccess: {
          if (!action.payload.timestamp) {
            return state;
          }
          return {
            ...state,
            files: ConfigFileAdapter.upsertOne(action.payload, state.files)
          };
        }

        case BackendActionTypes.SaveDraft: {
          return {
              ...state,
              files: ConfigFileAdapter.upsertOne(action.payload.file, state.files)
          };
        }

        case BackendActionTypes.CommitChangesSuccess: {
          action.payload.files.forEach((f) => {
            f.modified = false;
            f.originalConfig = f.config;
          });
          return {
              ...state,
              files: ConfigFileAdapter.upsertMany(action.payload.files, state.files)
          };
        }

        case BackendActionTypes.ResolveConficts: {
          return {
              ...state,
              files: ConfigFileAdapter.upsertMany(action.payload, state.files)
          };
        }

        case BackendActionTypes.DeleteFileSuccess: {
            return {
                ...state,
                files: ConfigFileAdapter.removeOne(ConfigFileAdapter.selectId(action.payload) + '', state.files)
            };
        }

        case AuthActionTypes.LogoutSuccess: {
            return initialState;
        }

        default: {
            return state;
        }
    }
}

export const getApplications = (state: State) => state.applications;
export const getAppFiles = (state: State) => ConfigFileAdapter.getSelectors().selectAll(state.files);

