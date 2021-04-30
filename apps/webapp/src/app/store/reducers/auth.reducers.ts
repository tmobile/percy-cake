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

import { AuthActionsUnion, AuthActionTypes } from "../actions/auth.actions";
import { BackendActionTypes, CheckoutSuccess } from "../actions/backend.actions";
import { User } from "models/auth";

export interface State {
  currentUser: User;
  loginError: Error;
  formProcessing: boolean;
  redirectUrl: string;
}

export const initialState: State = {
  currentUser: null,
  loginError: null,
  formProcessing: false,
  redirectUrl: null,
};

export const reducer = (state = initialState, action: AuthActionsUnion|CheckoutSuccess): State => {
  switch (action.type) {

    case AuthActionTypes.Login: {
      return {
        ...state,
        loginError: null,
        formProcessing: true,
      };
    }

    case AuthActionTypes.LoginSuccess: {
      return {
        ...state,
        loginError: null,
        formProcessing: false,
        currentUser: action.payload
      };
    }

    case AuthActionTypes.LoginFailure: {
      return {
        ...state,
        loginError: action.payload,
        formProcessing: false,
      };
    }

    case AuthActionTypes.LoginRedirect: {
      return {
        ...initialState,
        redirectUrl: action.payload.redirectUrl
      };
    }

    case AuthActionTypes.LogoutSuccess: {
      return initialState;
    }

    case BackendActionTypes.CheckoutSuccess: {
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          branchName: action.payload.branch
        }
      };
    }

    default: {
      return state;
    }
  }
};

export const getCurrentUser = (state: State) => state.currentUser;
export const getError = (state: State) => state.loginError;
export const getFormProcessing = (state: State) => state.formProcessing;
export const getRedirectUrl = (state: State) => state.redirectUrl;
