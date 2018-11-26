import { AuthActionsUnion, AuthActionTypes } from '../actions/auth.actions';
import { User } from 'models/auth';

export interface State {
    loggedIn: boolean;
    currentUser: User;
    loginError: Error;
    formProcessing: boolean;
    redirectUrl: string;
}

export const initialState: State = {
    loggedIn: false,
    currentUser: null,
    loginError: null,
    formProcessing: false,
    redirectUrl: null,
};

export function reducer(state = initialState, action: AuthActionsUnion): State {
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

export const getLoggedIn = (state: State) => state.loggedIn && state.currentUser;

export const getLoggedInUser = (state: State) => state.currentUser;
export const getError = (state: State) => state.loginError;
export const getFormProcessing = (state: State) => state.formProcessing;
export const getRedirectUrl = (state: State) => state.redirectUrl;
export const getRepositoryName = (state: State) => state.currentUser ? state.currentUser.repoName : null;
