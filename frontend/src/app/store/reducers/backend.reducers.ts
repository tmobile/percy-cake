import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { ConfigFile } from '../../models/config-file';
import { DashboardActionsUnion, BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';
import { AuthActionTypes } from '../actions/auth.actions';

export interface ConfigFiles extends EntityState<ConfigFile> {}

export interface State {
    applications: string[];
    files: ConfigFiles;
    initialized: boolean;
}

const ConfigFileAdapter: EntityAdapter<ConfigFile> = createEntityAdapter<ConfigFile>({
  selectId: (file) => `${file.applicationName}/${file.fileName}`,
});

export const GetConfigFile = (state: State, fileName: string, applicationName: string) => {
  return state.files.entities[ConfigFileAdapter.selectId({ fileName, applicationName})];
};

export const initialState: State = {
    applications: [],
    files: ConfigFileAdapter.getInitialState(),
    initialized: false,
};

export function reducer(state = initialState, action: DashboardActionsUnion): State {
    switch (action.type) {

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
          const freshFiles = _.mapKeys(action.payload, configFile => ConfigFileAdapter.selectId(configFile));
          let files = state.files;

          _.each(state.files.ids, (id: string) => {
            if (!freshFiles[id]) {
              files = ConfigFileAdapter.removeOne(id, files);
            } else {
              const freshFile = freshFiles[id];
              const existingFile = state.files.entities[id];
              if (freshFile.timestamp !== existingFile.timestamp) {
                freshFile.originalConfig = null; // Timestamp changes, Nullify the original config (so it will reload)
                files = ConfigFileAdapter.upsertOne(freshFile, files);
              }
              delete freshFiles[id];
            }
          });

          files = ConfigFileAdapter.addMany(_.values(freshFiles), files);

          return {
            ...state,
            files
          };
        }

        case BackendActionTypes.GetFileContentSuccess: {
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
            f.originalConfig = f.draftConfig;
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
export const getAllFiles = (state: State) => ConfigFileAdapter.getSelectors().selectAll(state.files);

