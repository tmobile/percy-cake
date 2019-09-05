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

import {
  ActionReducer,
  ActionReducerMap,
  createFeatureSelector,
  createSelector,
  MetaReducer
} from "@ngrx/store";
import { localStorageSync } from "ngrx-store-localstorage";
import * as fromAuth from "./reducers/auth.reducers";
import * as fromBackend from "./reducers/backend.reducers";
import * as fromDashboard from "./reducers/dashboard.reducer";
import * as fromEditor from "./reducers/editor.reducer";

import { AuthActionTypes } from "./actions/auth.actions";

export interface AppState {
  auth: fromAuth.State;
  backend: fromBackend.State;
  dashboard: fromDashboard.State;
  editor: fromEditor.State;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: fromAuth.reducer,
  backend: fromBackend.reducer,
  dashboard: fromDashboard.reducer,
  editor: fromEditor.reducer,
};

export function localStorageSyncReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return localStorageSync({ keys: [{ "auth": ["currentUser", "loggedIn"] }], rehydrate: true })(reducer);
}

export function clearState(reducer) {
  return function (state, action) {

    if (action.type === AuthActionTypes.LogoutSuccess) {
      state = undefined;
    }

    return reducer(state, action);
  };
}

export const metaReducers: MetaReducer<AppState>[] = [localStorageSyncReducer, clearState];

// dashboard related selectors
export const authState = createFeatureSelector<AppState, fromAuth.State>("auth");

export const getFormProcessing = createSelector(authState, fromAuth.getFormProcessing);
export const getCurrentUser = createSelector(authState, fromAuth.getCurrentUser);
export const getRedirectUrl = createSelector(authState, fromAuth.getRedirectUrl);
export const getLoginError = createSelector(authState, fromAuth.getError);

// backend related selectors
export const backendState = createFeatureSelector<AppState, fromBackend.State>("backend");
export const getPrincipal = createSelector(backendState, fromBackend.getPrincipal);
export const getApplications = createSelector(backendState, fromBackend.getApplications);
export const getAppConfigs = createSelector(backendState, fromBackend.getAppConfigs);
export const getAllFiles = createSelector(backendState, fromBackend.getAllFiles);
export const getCanPullRequest = createSelector(backendState, fromBackend.getCanPullRequest);
export const getCanSyncMaster = createSelector(backendState, fromBackend.getCanSyncMaster);
export const getLoadingFiles = createSelector(backendState, fromBackend.isLoadingFiles);

// dashboard related selectors
export const dashboardState = createFeatureSelector<AppState, fromDashboard.State>("dashboard");
export const getSelectedApp = createSelector(dashboardState, fromDashboard.getSelectedApp);
export const getCollapsedApps = createSelector(dashboardState, fromDashboard.getCollapsedApps);
export const getTableSort = createSelector(dashboardState, fromDashboard.getTableSort);
export const getDashboardFileDeleting = createSelector(dashboardState, fromDashboard.isDeletingFile);
export const getDashboardCommittingFile = createSelector(dashboardState, fromDashboard.isCommittingFile);
export const getDashboardRefreshing = createSelector(dashboardState, fromDashboard.isRefreshing);

// editor selectors
export const editorState = createFeatureSelector<AppState, fromEditor.State>("editor");

export const getConfigFile = createSelector(editorState, fromEditor.getConfigFile);
export const getConfiguration = createSelector(editorState, fromEditor.getConfiguration);
export const getEnvironments = createSelector(editorState, fromEditor.getEnvironments);
export const getIsCommitting = createSelector(editorState, fromEditor.isCommitting);
export const getIsSaving = createSelector(editorState, fromEditor.isSaving);
export const getIsPageDirty = createSelector(editorState, fromEditor.getIsPageDirty);


// all app state
export const getAppState = (state: AppState) => state;
