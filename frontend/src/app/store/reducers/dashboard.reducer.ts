import { DashboardActionsUnion, DashboardActionTypes } from '../actions/dashboard.actions';
import { BackendActionsUnion , BackendActionTypes } from '../actions/backend.actions';

import * as _ from 'lodash';

export interface State {
    deletingFile: boolean;
    committingFile: boolean;
    selectedApp: string;
    tableSort: any;
    collapsedApps: string[];
}

export const initialState: State = {
    deletingFile: false,
    committingFile: false,
    selectedApp: '',
    tableSort: {
      applicationName: 'asc',
      fileName: 'asc',
    },
    collapsedApps: [],
};

export function reducer(state = initialState, action: BackendActionsUnion | DashboardActionsUnion): State {
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
            let collapsedApps;
            if (_.includes(state.collapsedApps, action.payload)) {
              collapsedApps = _.without(state.collapsedApps, action.payload);
            } else {
              collapsedApps = _.concat(state.collapsedApps, action.payload);
            }
            return {
                ...state,
                collapsedApps
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
          };
        }

        case BackendActionTypes.CommitChangesSuccess: {
          return {
              ...state,
              committingFile: false,
          };
        }

        case BackendActionTypes.CommitChangesFailure: {
          return {
              ...state,
              committingFile: false,
          };
        }

        case BackendActionTypes.DeleteFile: {
            return {
                ...state,
                deletingFile: true,
            };
        }

        case BackendActionTypes.DeleteFileSuccess: {
            return {
                ...state,
                deletingFile: false,
            };
        }

        case BackendActionTypes.DeleteFileFailure: {
            return {
                ...state,
                deletingFile: false,
            };
        }

        default: {
            return state;
        }
    }
}

export const getSelectedApp = (state: State) => state.selectedApp;
export const getTableSort = (state: State) => state.tableSort;
export const getCollapsedApps = (state: State) => state.collapsedApps;
export const isDeletingFile = (state: State) => state.deletingFile;
export const isCommittingFile = (state: State) => state.committingFile;
