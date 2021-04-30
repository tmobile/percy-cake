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

import { DashboardActionsUnion, DashboardActionTypes } from "../actions/dashboard.actions";
import { BackendActionsUnion, BackendActionTypes } from "../actions/backend.actions";

import * as _ from "lodash";

export interface State {
  deletingFile: boolean;
  committingFile: boolean;
  refreshing: boolean;
  selectedApp: string;
  tableSort: any;
  collapsedApps: string[];
}

export const initialState: State = {
  deletingFile: false,
  committingFile: false,
  refreshing: false,
  selectedApp: "",
  tableSort: {
    applicationName: "asc",
    fileName: "asc",
  },
  collapsedApps: [],
};

export const reducer = (state = initialState, action: BackendActionsUnion | DashboardActionsUnion): State => {
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
        tableSort: { ...state.tableSort, ...action.payload }
      };
    }

    case BackendActionTypes.MergeBranch:
    case BackendActionTypes.CommitChanges: {
      return {
        ...state,
        committingFile: true,
      };
    }

    case BackendActionTypes.MergeBranchSuccess:
    case BackendActionTypes.CommitChangesSuccess: {
      return {
        ...state,
        committingFile: false,
      };
    }

    case BackendActionTypes.MergeBranchFailure:
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

    case BackendActionTypes.Checkout:
    case BackendActionTypes.Refresh: {
      return {
        ...state,
        refreshing: true,
      };
    }

    case BackendActionTypes.CheckoutSuccess:
    case BackendActionTypes.RefreshSuccess: {
      return {
        ...state,
        refreshing: false,
      };
    }

    case BackendActionTypes.CheckoutFailure:
    case BackendActionTypes.RefreshFailure: {
      return {
        ...state,
        refreshing: false,
      };
    }

    default: {
      return state;
    }
  }
};

export const getSelectedApp = (state: State) => state.selectedApp;
export const getTableSort = (state: State) => state.tableSort;
export const getCollapsedApps = (state: State) => state.collapsedApps;
export const isDeletingFile = (state: State) => state.deletingFile;
export const isCommittingFile = (state: State) => state.committingFile;
export const isRefreshing = (state: State) => state.refreshing;
