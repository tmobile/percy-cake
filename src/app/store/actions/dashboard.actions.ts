import { Action } from '@ngrx/store';

export enum DashboardActionTypes {
  SelectApp = '[Dashboard] Select Application',
  TableSort = '[Dashboard] Table Sort',
  ToggleApp = '[Dashboard] Toggle Application',
  CollapseApps = '[Dashboard] Collapse Applications',
}

export class SelectApp implements Action {
  readonly type = DashboardActionTypes.SelectApp;

  constructor(public payload: string) { }
}

export class TableSort implements Action {
  readonly type = DashboardActionTypes.TableSort;

  constructor(public payload: any) { }
}

export class CollapseApps implements Action {
  readonly type = DashboardActionTypes.CollapseApps;

  constructor(public payload: any) { }
}

export class ToggleApp implements Action {
  readonly type = DashboardActionTypes.ToggleApp;

  constructor(public payload: string) { }
}


export type DashboardActionsUnion =
  | SelectApp
  | TableSort
  | ToggleApp
  | CollapseApps
  ;
