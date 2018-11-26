import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { ConfigFile } from 'models/config-file';
import { BackendActionsUnion, BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';

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
    applications: null,
    files: ConfigFileAdapter.getInitialState(),
    initialized: false,
};

export function reducer(state = initialState, action: BackendActionsUnion): State {
    switch (action.type) {

        case BackendActionTypes.Initialized: {
            return {
                ...state,
                initialized: true
            };
        }

        case BackendActionTypes.LoadFilesSuccess: {
          const freshFiles = _.mapKeys(action.payload.files, configFile => ConfigFileAdapter.selectId(configFile));
          let files = state.files;

          _.each(state.files.ids, (id: string) => {
            if (!freshFiles[id]) {
              files = ConfigFileAdapter.removeOne(id, files);
            } else {
              const freshFile = freshFiles[id];
              freshFile.originalConfig = freshFile.draftConfig = null; // Nullify the config (so it will reload)
              files = ConfigFileAdapter.upsertOne(freshFile, files);
              delete freshFiles[id];
            }
          });

          files = ConfigFileAdapter.addMany(_.values(freshFiles), files);

          return {
            ...state,
            files,
            applications: action.payload.applications
          };
        }

        case BackendActionTypes.GetFileContentSuccess: {
          if (action.payload.newlyCreated) {
            return state;
          }
          return {
            ...state,
            files: ConfigFileAdapter.upsertOne(action.payload.file, state.files)
          };
        }

        case BackendActionTypes.SaveDraftSuccess: {
          return {
              ...state,
              files: ConfigFileAdapter.upsertOne(action.payload, state.files)
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

        default: {
            return state;
        }
    }
}

export const getApplications = (state: State) => state.applications;
export const getAllFiles = (state: State) => {
  const files = ConfigFileAdapter.getSelectors().selectAll(state.files);
  const grouped = _.groupBy(files, (file) => file.applicationName);
  _.each(state.applications, (app) => {
    if (!grouped[app]) {
      grouped[app] = [];
    }
  });
  return grouped;
};
