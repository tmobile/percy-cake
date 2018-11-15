import { Action } from '@ngrx/store';
import { Authenticate, User, Repo } from '../../models/auth';

export enum AuthActionTypes {
  Login = '[Auth] Login',
  LoginSuccess = '[Auth] Login Success',
  LoginFailure = '[Auth] Login Failure',
  LoginRedirect = '[Auth] Login Redirect',
  Logout = '[Auth] Logout',
  LogoutSuccess = '[Auth] Logout Success',
  GetDefaultRepo = '[Auth] Get Default Repo',
  GetDefaultRepoSuccess = '[Auth] Get Default Repo Success',
  GetDefaultRepoFailure = '[Auth] Get Default Repo Failure',
}

export class Login implements Action {
  readonly type = AuthActionTypes.Login;

  constructor(public payload: Authenticate) { }
}

export class LoginSuccess implements Action {
  readonly type = AuthActionTypes.LoginSuccess;

  constructor(public payload: User) { }
}

export class LoginFailure implements Action {
  readonly type = AuthActionTypes.LoginFailure;

  constructor(public payload: any) { }
}

export class LoginRedirect implements Action {
  readonly type = AuthActionTypes.LoginRedirect;
  constructor(public payload: { redirectUrl: string }) { }
}

export class Logout implements Action {
  readonly type = AuthActionTypes.Logout;
}

export class LogoutSuccess implements Action {
  readonly type = AuthActionTypes.LogoutSuccess;
}

export class GetDefaultRepo implements Action {
  readonly type = AuthActionTypes.GetDefaultRepo;
}

export class GetDefaultRepoSuccess implements Action {
  readonly type = AuthActionTypes.GetDefaultRepoSuccess;

  constructor(public payload: Repo) { }
}

export class GetDefaultRepoFailure implements Action {
  readonly type = AuthActionTypes.GetDefaultRepoFailure;

  constructor(public payload: any) { }
}

export type AuthActionsUnion =
  | Login
  | LoginSuccess
  | LoginFailure
  | LoginRedirect
  | Logout
  | LogoutSuccess
  | GetDefaultRepo
  | GetDefaultRepoSuccess
  | GetDefaultRepoFailure;
