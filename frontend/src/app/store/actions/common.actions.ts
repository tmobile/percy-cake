import { Action } from '@ngrx/store';
import { User } from '../../models/auth';
import { ConfigFile } from '../../models/config-file';

export enum CommonActionTypes {
    Alert = '[App] Alert',
    AlertClosed = '[App] Alert Closed',
    APIError = '[App] API Error',
}

export class Alert implements Action {
    readonly type = CommonActionTypes.Alert;

    constructor(public payload: { message: string, editorType?: string }) { }
}

export class AlertClosed implements Action {
    readonly type = CommonActionTypes.AlertClosed;

    constructor(public payload: any) { }
}

export class APIError implements Action {
    readonly type = CommonActionTypes.APIError;

    constructor(public payload: any) { }
}


export type DashboardActionsUnion =
    | Alert
    | AlertClosed
    | APIError;
