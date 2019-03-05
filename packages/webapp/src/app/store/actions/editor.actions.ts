/**
 *   Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { Action } from '@ngrx/store';

import { Configuration } from 'models/config-file';

export enum EditorActionTypes {
  PageLoad = '[Editor] Page Load',
  PageLoadSuccess = '[Editor] Page Load Success',
  PageLoadFailure = '[Editor] Page Load Failure',
  PageRestore = '[Editor] Page restore',
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

export class PageRestore implements Action {
  readonly type = EditorActionTypes.PageRestore;

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
  | PageRestore
  | ConfigurationChange
  ;
