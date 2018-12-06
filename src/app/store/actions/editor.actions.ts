import { Action } from '@ngrx/store';

import { Configuration } from 'models/config-file';

export enum EditorActionTypes {
  PageLoad = '[Editor] Page Load',
  PageLoadSuccess = '[Editor] Page Load Success',
  PageLoadFailure = '[Editor] Page Load Failure',
  ConfigurationChange = '[Editor] Configuration Change',
}

export class PageLoad implements Action {
  readonly type = EditorActionTypes.PageLoad;

  constructor(public payload: { fileName: string, applicationName: string, editMode: boolean }) { }
}

export class PageLoadSuccess implements Action {
  readonly type = EditorActionTypes.PageLoadSuccess;

  constructor(public payload: { environments: string[] }) { }
}

export class PageLoadFailure implements Action {
  readonly type = EditorActionTypes.PageLoadFailure;
  constructor(public payload: any) { }
}

export class ConfigurationChange implements Action {
  readonly type = EditorActionTypes.ConfigurationChange;
  constructor(public payload: Configuration) { }
}

export type EditorActionsUnion =
  | PageLoad
  | PageLoadSuccess
  | PageLoadFailure
  | ConfigurationChange
  ;
