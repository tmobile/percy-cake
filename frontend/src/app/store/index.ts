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

export const metaReducers: MetaReducer<AppState>[] = [localStorageSyncReducer];

// dashboard related selectors
export const authState = createFeatureSelector<AppState, fromAuth.State>('auth');

export const getDefaultRepo = createSelector(authState, fromAuth.getDefaultRepo);
export const getLoggedIn = createSelector(authState, fromAuth.getLoggedIn);
export const getFormProcessing = createSelector(authState, fromAuth.getFormProcessing);
export const getCurrentUser = createSelector(authState, fromAuth.getLoggedInUser);
export const getRedirectUrl = createSelector(authState, fromAuth.getRedirectUrl);
export const getLoginError = createSelector(authState, fromAuth.getError);
export const getRepositoryName = createSelector(authState, fromAuth.getRepositoryName);

// backend related selectors
export const backendState = createFeatureSelector<AppState, fromBackend.State>('backend');
export const getApplications = createSelector(backendState, fromBackend.getApplications);
export const getAllFiles = createSelector(backendState, fromBackend.getAllFiles);


// dashboard related selectors
export const dashboardState = createFeatureSelector<AppState, fromDashboard.State>('dashboard');
export const getSelectedApp = createSelector(dashboardState, fromDashboard.getSelectedApp);
export const getCollapsedApps = createSelector(dashboardState, fromDashboard.getCollapsedApps);
export const getTableSort = createSelector(dashboardState, fromDashboard.getTableSort);
export const getDashboardError = createSelector(dashboardState, fromDashboard.getError);
export const getDashboardFileDeleting = createSelector(dashboardState, fromDashboard.isDeletingFile);
export const getDashboardCommittingFile = createSelector(dashboardState, fromDashboard.isCommittingFile);

// editor selectors
export const editorState = createFeatureSelector<AppState, fromEditor.State>('editor');

export const getConfiguration = createSelector(editorState, fromEditor.getConfiguration);
export const getEnvironments = createSelector(editorState, fromEditor.getEnvironments);
export const getIsCommitting = createSelector(editorState, fromEditor.isCommitting);
export const getEditorError = createSelector(editorState, fromEditor.getError);
export const getMode = createSelector(editorState, fromEditor.getMode);
export const getFilePath = createSelector(editorState, fromEditor.getFilePath);
export const getShowAsCode = createSelector(editorState, fromEditor.getShowAsCode);
export const getPreviewCode = createSelector(editorState, fromEditor.getPreviewCode);
export const getShowAsCompiledYAMLEnvironment = createSelector(editorState, fromEditor.getShowAsCompiledYAMLEnvironment);
export const getSelectedNode = createSelector(editorState, fromEditor.getSelectedNode);
export const getCurrentAddEditProperty = createSelector(editorState, fromEditor.getCurrentAddEditProperty);
export const getSelectedConfigProperty = createSelector(editorState, fromEditor.getSelectedConfigProperty);
export const getIsPageDirty = createSelector(editorState, fromEditor.getIsPageDirty);


// all app state
export const getAppState = (state: AppState) => state;
