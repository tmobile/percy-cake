import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { Principal } from 'models/auth';
import { ConfigFile } from 'models/config-file';
import { BackendActionsUnion, BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';

export interface ConfigFiles extends EntityState<ConfigFile> { }

export interface State {
  applications: string[];
  files: ConfigFiles;
  principal: Principal;
  redirectUrl: string;
  canPullRequest: boolean;
  canSyncMaster: boolean;
}

const ConfigFileAdapter: EntityAdapter<ConfigFile> = createEntityAdapter<ConfigFile>({
  selectId: (file) => `${file.applicationName}/${file.fileName}`,
});

export const GetConfigFile = (state: State, fileName: string, applicationName: string) => {
  return state.files.entities[ConfigFileAdapter.selectId({ fileName, applicationName })];
};

export const initialState: State = {
  applications: null,
  files: ConfigFileAdapter.getInitialState(),
  principal: null,
  redirectUrl: null,
  canPullRequest: false,
  canSyncMaster: false
};

export function reducer(state = initialState, action: BackendActionsUnion): State {
  switch (action.type) {

    case BackendActionTypes.Initialize: {
      return {
        ...initialState,
        redirectUrl: action.payload.redirectUrl
      };
    }
    case BackendActionTypes.Initialized: {
      return {
        ...state,
        ...action.payload
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
          const oldOid = state.files.entities[id].oid;
          const newOid = freshFile.oid;
          if ((!oldOid && newOid) || (oldOid && !newOid) || (oldOid && newOid && oldOid !== newOid)) {
            freshFile.originalConfig = freshFile.draftConfig = undefined; // Nullify the config (so it will reload)
          }
          files = ConfigFileAdapter.upsertOne(freshFile, files);
          delete freshFiles[id];
        }
      });

      files = ConfigFileAdapter.addMany(_.values(freshFiles), files);

      return {
        ...state,
        canPullRequest: !!action.payload.canPullRequest,
        canSyncMaster: !!action.payload.canSyncMaster,
        files,
        applications: _.orderBy(action.payload.applications)
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
      return {
        ...state,
        files: ConfigFileAdapter.upsertMany(action.payload.files, state.files)
      };
    }

    case BackendActionTypes.DeleteFileSuccess: {
      return {
        ...state,
        files: ConfigFileAdapter.removeOne(ConfigFileAdapter.selectId(action.payload) + '', state.files)
      };
    }

    case BackendActionTypes.CheckoutSuccess: {
      return {
        ...state,
        principal: {
          user: {
            ...state.principal.user,
            branchName: action.payload.branch
          },
          repoMetadata: {
            ...state.principal.repoMetadata,
            branchName: action.payload.branch
          }
        }
      };
    }

    default: {
      return state;
    }
  }
}

export const getPrincipal = (state: State) => state.principal;
export const getCanPullRequest = (state: State) => state.canPullRequest;
export const getCanSyncMaster = (state: State) => state.canSyncMaster;
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
