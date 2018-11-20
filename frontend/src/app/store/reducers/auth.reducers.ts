import { HttpErrorResponse } from '@angular/common/http';

import { AuthActionsUnion, AuthActionTypes } from 'store/actions/auth.actions';
import { User, Repo } from 'models/auth';

export interface State {
    loggedIn: boolean;
    currentUser: User;
    loginError: HttpErrorResponse;
    formProcessing: boolean;
    redirectUrl: string;
    defaultRepo: Repo;
}

export const initialState: State = {
    loggedIn: false,
    currentUser: null,
    loginError: null,
    formProcessing: false,
    redirectUrl: null,
    defaultRepo: null
};

export function reducer(state = initialState, action: AuthActionsUnion): State {
    switch (action.type) {

        case AuthActionTypes.GetDefaultRepoSuccess: {
            return {
                ...state,
                defaultRepo: action.payload
            };
        }

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
                loggedIn: true,
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

        default: {
            return state;
        }
    }
}

export const getLoggedIn = (state: State) =>
    state.loggedIn && state.currentUser.token
    && Date.parse(state.currentUser.validUntil) > (new Date()).getTime();

export const getDefaultRepo = (state: State) => state.defaultRepo;
export const getLoggedInUser = (state: State) => state.currentUser;
export const getError = (state: State) => state.loginError;
export const getFormProcessing = (state: State) => state.formProcessing;
export const getRedirectUrl = (state: State) => state.redirectUrl;
export const getRepositoryName = (state: State) => state.currentUser ? state.currentUser.repoName : null;
