import {
  ActionReducer,
  ActionReducerMap,
  createFeatureSelector,
  createSelector,
  MetaReducer
} from '@ngrx/store';
import { localStorageSync } from 'ngrx-store-localstorage';
import * as fromAuth from './reducers/auth.reducers';
import * as fromBackend from './reducers/backend.reducers';
import * as fromDashboard from './reducers/dashboard.reducer';
import * as fromEditor from './reducers/editor.reducer';

import { AuthActionTypes } from './actions/auth.actions';

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
  return localStorageSync({ keys: [{ 'auth': ['currentUser', 'loggedIn'] }], rehydrate: true })(reducer);
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
export const authState = createFeatureSelector<AppState, fromAuth.State>('auth');

export const getFormProcessing = createSelector(authState, fromAuth.getFormProcessing);
export const getCurrentUser = createSelector(authState, fromAuth.getCurrentUser);
export const getRedirectUrl = createSelector(authState, fromAuth.getRedirectUrl);
export const getLoginError = createSelector(authState, fromAuth.getError);

// backend related selectors
export const backendState = createFeatureSelector<AppState, fromBackend.State>('backend');
export const getPrincipal = createSelector(backendState, fromBackend.getPrincipal);
export const getApplications = createSelector(backendState, fromBackend.getApplications);
export const getAllFiles = createSelector(backendState, fromBackend.getAllFiles);


// dashboard related selectors
export const dashboardState = createFeatureSelector<AppState, fromDashboard.State>('dashboard');
export const getSelectedApp = createSelector(dashboardState, fromDashboard.getSelectedApp);
export const getCollapsedApps = createSelector(dashboardState, fromDashboard.getCollapsedApps);
export const getTableSort = createSelector(dashboardState, fromDashboard.getTableSort);
export const getDashboardFileDeleting = createSelector(dashboardState, fromDashboard.isDeletingFile);
export const getDashboardCommittingFile = createSelector(dashboardState, fromDashboard.isCommittingFile);
export const getDashboardRefreshing = createSelector(dashboardState, fromDashboard.isRefreshing);

// editor selectors
export const editorState = createFeatureSelector<AppState, fromEditor.State>('editor');

export const getConfigFile = createSelector(editorState, fromEditor.getConfigFile);
export const getConfiguration = createSelector(editorState, fromEditor.getConfiguration);
export const getEnvironments = createSelector(editorState, fromEditor.getEnvironments);
export const getIsCommitting = createSelector(editorState, fromEditor.isCommitting);
export const getIsSaving = createSelector(editorState, fromEditor.isSaving);
export const getIsPageDirty = createSelector(editorState, fromEditor.getIsPageDirty);


// all app state
export const getAppState = (state: AppState) => state;
