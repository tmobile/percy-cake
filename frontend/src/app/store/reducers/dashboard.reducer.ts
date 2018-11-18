import { DashboardActionsUnion, DashboardActionTypes } from '../actions/dashboard.actions';
import { AuthActionTypes } from '../actions/auth.actions';
import { BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';

export interface State {
    error: any;
    deletingFile: boolean;
    committingFile: boolean;
    selectedApp: string;
    tableSort: any;
    collapsedApps: any;
}

export const initialState: State = {
    error: null,
    deletingFile: false,
    committingFile: false,
    selectedApp: '',
    tableSort: {
      applicationName: 'asc',
      fileName: 'asc',
    },
    collapsedApps: {},
};

export function reducer(state = initialState, action: DashboardActionsUnion): State {
    switch (action.type) {
        case DashboardActionTypes.SelectApp: {
            return {
                ...state,
                selectedApp: action.payload
            };
        }
        case DashboardActionTypes.CollapseApps: {
            return {
                ...state,
                collapsedApps: action.payload
            };
        }
        case DashboardActionTypes.ToggleApp: {
            return {
                ...state,
                collapsedApps: {...state.collapsedApps, [action.payload]: !state.collapsedApps[action.payload]}
            };
        }
        case DashboardActionTypes.TableSort: {
            return {
                ...state,
                tableSort: {...state.tableSort, ...action.payload}
            };
        }

        case BackendActionTypes.CommitChanges: {
          return {
              ...state,
              committingFile: true,
              error: null,
          };
        }

        case BackendActionTypes.CommitChangesSuccess: {
          return {
              ...state,
              committingFile: false,
              error: null,
          };
        }

        case BackendActionTypes.CommitChangesFailure: {
          return {
              ...state,
              committingFile: false,
              error: action.payload.error.message,
          };
        }

        case BackendActionTypes.DeleteFile: {
            return {
                ...state,
                deletingFile: true,
                error: null,
            };
        }

        case BackendActionTypes.DeleteFileSuccess: {
            return {
                ...state,
                error: null,
                deletingFile: false,
            };
        }

        case BackendActionTypes.DeleteFileFailure: {
            return {
                ...state,
                error: action.payload.message,
                deletingFile: false,
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

export const getSelectedApp = (state: State) => state.selectedApp;
export const getTableSort = (state: State) => state.tableSort;
export const getCollapsedApps = (state: State) => state.collapsedApps;
export const getError = (state: State) => state.error;
export const isDeletingFile = (state: State) => state.deletingFile;
export const isCommittingFile = (state: State) => state.committingFile;

