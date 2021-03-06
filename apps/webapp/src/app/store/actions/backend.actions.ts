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

import { ConfigFile } from "models/config-file";
import { Principal } from "models/auth";

export enum BackendActionTypes {
  Initialize = "[Backend] Initialize",
  Initialized = "[Backend] Initialized",
  ListApplications = "[Backend] List Applications",
  ListApplicationsSuccess = "[Backend] List Applications Success",
  ListApplicationsFailure = "[Backend] List Applications Failure",
  LoadFiles = "[Backend] Load Files",
  LoadFilesSuccess = "[Backend] Load Files Success",
  LoadFilesFailure = "[Backend] Load Files Failure",
  GetFileContent = "[Backend] Get File Content",
  GetFileContentSuccess = "[Backend] Get File Content Success",
  GetFileContentFailure = "[Backend] Get File Content Failure",
  DeleteFile = "[Backend] Delete File",
  DeleteFileFailure = "[Backend] Delete File Failure",
  DeleteFileSuccess = "[Backend] Delete File Success",
  SaveDraft = "[Backend] Save Draft",
  SaveDraftSuccess = "[Backend] Save Draft Success",
  SaveDraftFailure = "[Backend] Save Draft Failure",
  CommitChanges = "[Backend] Commit Changes",
  CommitChangesSuccess = "[Backend] Commit Changes Success",
  CommitChangesFailure = "[Backend] Commit Changes Failure",
  Refresh = "[Backend] Refresh",
  RefreshSuccess = "[Backend] Refresh Success",
  RefreshFailure = "[Backend] Refresh Failure",
  Checkout = "[Backend] Checkout",
  CheckoutSuccess = "[Backend] Checkout Success",
  CheckoutFailure = "[Backend] Checkout Failure",
  MergeBranch = "[Backend] Merge Branch",
  MergeBranchSuccess = "[Backend] Merge Branch Success",
  MergeBranchFailure = "[Backend] Merge Branch Failure"
}

export class Initialize implements Action {
  readonly type = BackendActionTypes.Initialize;
  constructor(public payload: { redirectUrl: string }) {}
}

export class Initialized implements Action {
  readonly type = BackendActionTypes.Initialized;

  constructor(public payload: { principal: Principal }) {}
}

export class LoadFiles implements Action {
  readonly type = BackendActionTypes.LoadFiles;
}

export class LoadFilesSuccess implements Action {
  readonly type = BackendActionTypes.LoadFilesSuccess;

  constructor(
    public payload: {
      files: ConfigFile[];
      applications: string[];
      appConfigs: { [app: string]: any };
      canPullRequest?: boolean;
      canSyncMaster?: boolean;
    }
  ) {}
}

export class LoadFilesFailure implements Action {
  readonly type = BackendActionTypes.LoadFilesFailure;

  constructor(public payload: Error) {}
}

export class GetFileContent implements Action {
  readonly type = BackendActionTypes.GetFileContent;
  constructor(public payload: ConfigFile) {}
}

export class GetFileContentSuccess implements Action {
  readonly type = BackendActionTypes.GetFileContentSuccess;
  constructor(public payload: { file: ConfigFile; newlyCreated?: boolean }) {}
}

export class GetFileContentFailure implements Action {
  readonly type = BackendActionTypes.GetFileContentFailure;
  constructor(public payload: Error) {}
}

export class DeleteFile implements Action {
  readonly type = BackendActionTypes.DeleteFile;

  constructor(public payload: ConfigFile) {}
}

export class DeleteFileSuccess implements Action {
  readonly type = BackendActionTypes.DeleteFileSuccess;
  constructor(public payload: ConfigFile) {}
}

export class DeleteFileFailure implements Action {
  readonly type = BackendActionTypes.DeleteFileFailure;

  constructor(public payload: Error) {}
}

export class SaveDraft implements Action {
  readonly type = BackendActionTypes.SaveDraft;

  constructor(public payload: { file: ConfigFile; redirect: boolean }) {}
}

export class SaveDraftSuccess implements Action {
  readonly type = BackendActionTypes.SaveDraftSuccess;

  constructor(public payload: ConfigFile) {}
}

export class SaveDraftFailure implements Action {
  readonly type = BackendActionTypes.SaveDraftFailure;

  constructor(public payload: Error) {}
}

export class CommitChanges implements Action {
  readonly type = BackendActionTypes.CommitChanges;

  constructor(
    public payload: {
      files: ConfigFile[];
      message: string;
      fromEditor?: boolean;
      resolveConflicts?: boolean;
    }
  ) {}
}

export class CommitChangesSuccess implements Action {
  readonly type = BackendActionTypes.CommitChangesSuccess;

  constructor(public payload: { files: ConfigFile[]; fromEditor?: boolean }) {}
}

export class CommitChangesFailure implements Action {
  readonly type = BackendActionTypes.CommitChangesFailure;

  constructor(
    public payload: {
      error: Error;
      files: ConfigFile[];
      commitMessage: string;
      fromEditor?: boolean;
    }
  ) {}
}

export class Refresh implements Action {
  readonly type = BackendActionTypes.Refresh;

  constructor() {}
}

export class RefreshSuccess implements Action {
  readonly type = BackendActionTypes.RefreshSuccess;

  constructor() {}
}

export class RefreshFailure implements Action {
  readonly type = BackendActionTypes.RefreshFailure;

  constructor(public payload: Error) {}
}

export class Checkout implements Action {
  readonly type = BackendActionTypes.Checkout;

  constructor(public payload: { type: string; branch: string }) {}
}

export class CheckoutSuccess implements Action {
  readonly type = BackendActionTypes.CheckoutSuccess;

  constructor(public payload: { branch: string }) {}
}

export class CheckoutFailure implements Action {
  readonly type = BackendActionTypes.CheckoutFailure;

  constructor(public payload: Error) {}
}

export class MergeBranch implements Action {
  readonly type = BackendActionTypes.MergeBranch;

  constructor(
    public payload: {
      srcBranch: string;
      targetBranch: string;
      diff?: { toSave: ConfigFile[]; toDelete: ConfigFile[] };
    }
  ) {}
}

export class MergeBranchSuccess implements Action {
  readonly type = BackendActionTypes.MergeBranchSuccess;

  constructor() {}
}

export class MergeBranchFailure implements Action {
  readonly type = BackendActionTypes.MergeBranchFailure;

  constructor(public payload: Error) {}
}

export type BackendActionsUnion =
  | Initialize
  | Initialized
  | LoadFiles
  | LoadFilesSuccess
  | LoadFilesFailure
  | GetFileContent
  | GetFileContentSuccess
  | GetFileContentFailure
  | DeleteFile
  | DeleteFileSuccess
  | DeleteFileFailure
  | SaveDraft
  | SaveDraftSuccess
  | SaveDraftFailure
  | CommitChanges
  | CommitChangesSuccess
  | CommitChangesFailure
  | Refresh
  | RefreshSuccess
  | RefreshFailure
  | Checkout
  | CheckoutSuccess
  | CheckoutFailure
  | MergeBranch
  | MergeBranchSuccess
  | MergeBranchFailure;
