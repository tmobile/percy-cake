/** ========================================================================
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

import { Action } from "@ngrx/store";

export enum CommonActionTypes {
  Alert = "[App] Alert",
  AlertClosed = "[App] Alert Closed",
  APIError = "[App] API Error",
  Navigate = "[App] Navigate"
}

export class Alert implements Action {
  readonly type = CommonActionTypes.Alert;

  constructor(public payload: { message: string; alertType?: string }) {}
}

export class AlertClosed implements Action {
  readonly type = CommonActionTypes.AlertClosed;

  constructor(public payload: any) {}
}

export class APIError implements Action {
  readonly type = CommonActionTypes.APIError;

  constructor(public payload: any) {}
}

export class Navigate implements Action {
  readonly type = CommonActionTypes.Navigate;

  constructor(public payload: string[]) {}
}

export type DashboardActionsUnion = Alert | AlertClosed | APIError | Navigate;
