import { Action } from '@ngrx/store';
import { LogoutSuccess } from './auth.actions';
import {
  CommitChanges, CommitChangesSuccess, CommitChangesFailure,
  DeleteFile, DeleteFileSuccess, DeleteFileFailure } from './backend.actions';

export enum DashboardActionTypes {
  SelectApp = '[Dashboard] Select Application',
}

export class SelectApp implements Action {
  readonly type = DashboardActionTypes.SelectApp;

  constructor(public payload: string) { }
}


export type DashboardActionsUnion =
  | SelectApp
  | DeleteFile
  | DeleteFileSuccess
  | DeleteFileFailure
  | CommitChanges
  | CommitChangesSuccess
  | CommitChangesFailure
  | LogoutSuccess;
