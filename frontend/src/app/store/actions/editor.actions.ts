import { Action } from '@ngrx/store';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { ConfigProperty } from 'models/config-property';

export enum EditorActionTypes {
    PageLoad = '[Editor] Page Load',
    PageLoadSuccess = '[Editor] Page Load Success',
    PageLoadFailure = '[Editor] Page Load Failure',
    ViewCompiledYAMLSuccess = '[Editor] View Compiled YAML Success',
    OpenAddEditProperty = '[Editor] Open Add Edit Property',
    CancelAddEditProperty = '[Editor] Cancel Add Edit Property',
    SaveAddEditProperty = '[Editor] Save Add Edit Property',
    NodeSelectedSuccess = '[Editor] Node Selected Success',
    ConfigurationChange = '[Editor] Configuration Change',
}

export class PageLoad implements Action {
    readonly type = EditorActionTypes.PageLoad;

    constructor(public payload: { applicationName: string, editMode: boolean }) { }
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

export class ViewCompiledYAMLSuccess implements Action {
    readonly type = EditorActionTypes.ViewCompiledYAMLSuccess;
    constructor(public payload: { environment: string, compiledYAML: string }) { }
}

export class OpenAddEditProperty implements Action {
    readonly type = EditorActionTypes.OpenAddEditProperty;
    constructor(public payload: { property: ConfigProperty }) { }
}

export class CancelAddEditProperty implements Action {
    readonly type = EditorActionTypes.CancelAddEditProperty;
}

export class SaveAddEditProperty implements Action {
    readonly type = EditorActionTypes.SaveAddEditProperty;
    constructor(public payload: { node: TreeNode }) { }
}

export class NodeSelectedSuccess implements Action {
    readonly type = EditorActionTypes.NodeSelectedSuccess;
    constructor(public payload: { node: TreeNode , compiledYAML: string }) { }
}

export type EditorActionsUnion =
    | PageLoad
    | PageLoadSuccess
    | PageLoadFailure
    | ViewCompiledYAMLSuccess
    | OpenAddEditProperty
    | CancelAddEditProperty
    | SaveAddEditProperty
    | NodeSelectedSuccess
    | ConfigurationChange
    ;
