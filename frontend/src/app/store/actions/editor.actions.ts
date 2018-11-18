import { Action } from '@ngrx/store';

import { TreeNode } from '../../models/tree-node';
import { ConfigProperty } from '../../models/config-property';
import { Configuration } from '../../models/config-file';

export enum EditorActionTypes {
    PageLoad = '[Editor] Page Load',
    PageLoadSuccess = '[Editor] Page Load Success',
    PageLoadFailure = '[Editor] Page Load Failure',
    ViewCompiledYAML = '[Editor] View Compiled YAML',
    ViewCompiledYAMLSuccess = '[Editor] View Compiled YAML Success',
    ChangeFileName = '[Editor] Change File Name',
    SaveFile = '[Editor] Save File',
    OpenAddEditProperty = '[Editor] Open Add Edit Property',
    CancelAddEditProperty = '[Editor] Cancel Add Edit Property',
    SaveAddEditProperty = '[Editor] Save Add Edit Property',
    NodeSelected = '[Editor] Node Selected',
    NodeSelectedSuccess = '[Editor] Node Selected Success',
    ConfigurationChange = '[Editor] Configuration Change',
}

export class PageLoad implements Action {
    readonly type = EditorActionTypes.PageLoad;

    constructor(public payload: { inEditMode: boolean, inEnvMode: boolean, appName: string, fileName: string }) { }
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

export class ViewCompiledYAML implements Action {
    readonly type = EditorActionTypes.ViewCompiledYAML;
    constructor(public payload: { environment: string }) { }
}

export class ViewCompiledYAMLSuccess implements Action {
    readonly type = EditorActionTypes.ViewCompiledYAMLSuccess;
    constructor(public payload: { compiledYAML: string }) { }
}

export class ChangeFileName implements Action {
  readonly type = EditorActionTypes.ChangeFileName;
  constructor(public payload: string) { }
}

export class SaveFile implements Action {
    readonly type = EditorActionTypes.SaveFile;
    constructor(public payload: {redirectToDashboard: boolean}) { }
}

export class OpenAddEditProperty implements Action {
    readonly type = EditorActionTypes.OpenAddEditProperty;
    constructor(public payload: { options: any }) { }
}

export class CancelAddEditProperty implements Action {
    readonly type = EditorActionTypes.CancelAddEditProperty;
}

export class SaveAddEditProperty implements Action {
    readonly type = EditorActionTypes.SaveAddEditProperty;
    constructor(public payload: { node: TreeNode }) { }
}

export class NodeSelected implements Action {
    readonly type = EditorActionTypes.NodeSelected;
    constructor(public payload: { node: TreeNode }) { }
}

export class NodeSelectedSuccess implements Action {
    readonly type = EditorActionTypes.NodeSelectedSuccess;
    constructor(public payload: { compiledYAML: string, configProperty: ConfigProperty }) { }
}

export type EditorActionsUnion =
    | PageLoad
    | PageLoadSuccess
    | PageLoadFailure
    | ViewCompiledYAML
    | ViewCompiledYAMLSuccess
    | ChangeFileName
    | SaveFile
    | OpenAddEditProperty
    | CancelAddEditProperty
    | SaveAddEditProperty
    | NodeSelected
    | NodeSelectedSuccess
    | ConfigurationChange
    ;
