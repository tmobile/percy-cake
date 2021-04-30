/**
========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { EntityState, EntityAdapter, createEntityAdapter } from "@ngrx/entity";

import { Principal } from "models/auth";
import { ConfigFile, FileTypes } from "models/config-file";
import { BackendActionsUnion, BackendActionTypes } from "../actions/backend.actions";

import * as _ from "lodash";

export interface ConfigFiles extends EntityState<ConfigFile> { }

export interface State {
  applications: string[];
  appConfigs: {[app: string]: any};
  files: ConfigFiles;
  principal: Principal;
  redirectUrl: string;
  canPullRequest: boolean;
  canSyncMaster: boolean;
  loadingFiles: boolean;
}

const CONFIG_FILE_ADAPTER: EntityAdapter<ConfigFile> = createEntityAdapter<ConfigFile>({
  selectId: (file) => `${file.applicationName}/${file.fileName}`,
});

export const getConfigFile = (state: State, fileName: string, applicationName: string) =>
  state.files.entities[CONFIG_FILE_ADAPTER.selectId({ fileName, applicationName })];

export const initialState: State = {
  applications: null,
  appConfigs: {},
  files: CONFIG_FILE_ADAPTER.getInitialState(),
  principal: null,
  redirectUrl: null,
  canPullRequest: false,
  canSyncMaster: false,
  loadingFiles: false
};

export const reducer = (state = initialState, action: BackendActionsUnion): State => {
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

    case BackendActionTypes.LoadFiles: {
      return {
        ...state,
        loadingFiles: true,
        applications: null
      };
    }

    case BackendActionTypes.LoadFilesSuccess: {
      const freshFiles = _.mapKeys(action.payload.files, configFile => CONFIG_FILE_ADAPTER.selectId(configFile));
      let files = state.files;

      _.each(state.files.ids, (id: string) => {
        if (!freshFiles[id]) {
          files = CONFIG_FILE_ADAPTER.removeOne(id, files);
        } else {
          const freshFile = freshFiles[id];
          const oldOid = state.files.entities[id].oid;
          const newOid = freshFile.oid;
          if ((!oldOid && newOid) || (oldOid && !newOid) || (oldOid && newOid && oldOid !== newOid)) {
            freshFile.originalConfig = freshFile.draftConfig = undefined; // Nullify the config (so it will reload)
          }
          files = CONFIG_FILE_ADAPTER.upsertOne(freshFile, files);
          delete freshFiles[id];
        }
      });

      files = CONFIG_FILE_ADAPTER.addMany(_.values(freshFiles), files);

      return {
        ...state,
        canPullRequest: !!action.payload.canPullRequest,
        canSyncMaster: !!action.payload.canSyncMaster,
        files,
        appConfigs: action.payload.appConfigs || {},
        applications: _.orderBy(action.payload.applications),
        loadingFiles: false
      };
    }

    case BackendActionTypes.LoadFilesFailure: {
      return {
        ...state,
        loadingFiles: false
      };
    }

    case BackendActionTypes.GetFileContentSuccess: {
      if (action.payload.newlyCreated) {
        return state;
      }
      return {
        ...state,
        files: CONFIG_FILE_ADAPTER.upsertOne(action.payload.file, state.files)
      };
    }

    case BackendActionTypes.SaveDraftSuccess: {
      const appConfigs = { ...state.appConfigs };

      // update appConfig if the saved file is a percyrc file and if its an application in the apps folder
      const file = action.payload;
      const applicationName = file.applicationName;
      if (file.fileType === FileTypes.PERCYRC && appConfigs[applicationName]) {
        const newAppConfig = file.draftContent ? JSON.parse(file.draftContent) : {};
        appConfigs[applicationName] = { ...appConfigs[applicationName], ...newAppConfig };
      }

      return {
        ...state,
        files: CONFIG_FILE_ADAPTER.upsertOne(file, state.files),
        appConfigs
      };
    }

    case BackendActionTypes.CommitChangesSuccess: {
      return {
        ...state,
        files: CONFIG_FILE_ADAPTER.upsertMany(action.payload.files, state.files)
      };
    }

    case BackendActionTypes.DeleteFileSuccess: {
      return {
        ...state,
        files: CONFIG_FILE_ADAPTER.removeOne(CONFIG_FILE_ADAPTER.selectId(action.payload) + "", state.files)
      };
    }

    case BackendActionTypes.CheckoutSuccess: {
      return {
        ...state,
        files: initialState.files, // empty the files when checkout, later LoadFiles action will reload them
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
};

export const getPrincipal = (state: State) => state.principal;
export const getCanPullRequest = (state: State) => state.canPullRequest;
export const getCanSyncMaster = (state: State) => state.canSyncMaster;
export const getApplications = (state: State) => state.applications;
export const getAppConfigs = (state: State) => state.appConfigs;
export const getAllFiles = (state: State) => {
  const files = CONFIG_FILE_ADAPTER.getSelectors().selectAll(state.files);
  const grouped = _.groupBy(files, (file) => file.applicationName);
  _.each(state.applications, (app) => {
    if (!grouped[app]) {
      grouped[app] = [];
    }
  });
  return grouped;
};
export const isLoadingFiles = (state: State) => state.loadingFiles;
