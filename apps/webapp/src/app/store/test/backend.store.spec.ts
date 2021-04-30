/**
========================================================================
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

import * as _ from "lodash";
import * as HttpErrors from "http-errors";

import { Principal } from "models/auth";
import { ConfigFile, Configuration, FileTypes } from "models/config-file";
import { FileManagementService } from "services/file-management.service";
import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";
import { ConflictDialogComponent } from "components/conflict-dialog/conflict-dialog.component";

import { StoreTestComponent, SETUP, TestContext, TEST_USER, assertDialogOpened } from "test/test-helper";

import * as AuthActions from "../actions/auth.actions";
import * as BackendActions from "../actions/backend.actions";
import * as reducer from "../reducers/backend.reducers";

const percyConfig = { key: "value" };

const file1: ConfigFile = {
  fileName: "test1.yaml",
  fileType: FileTypes.YAML,
  applicationName: "app1",
  modified: true
};

const file2: ConfigFile = {
  fileName: "test2.yaml",
  fileType: FileTypes.YAML,
  applicationName: "app1",
  oid: "222222",
  modified: false
};

const file3: ConfigFile = {
  fileName: "test3.yaml",
  fileType: FileTypes.YAML,
  applicationName: "app1",
  oid: "333333",
  modified: true
};

const file4: ConfigFile = {
  fileName: ".percyrc",
  fileType: FileTypes.PERCYRC,
  applicationName: "app1",
  oid: "444444",
  modified: true,
  draftContent: JSON.stringify(percyConfig)
};

describe("Backend store action/effect/reducer", () => {
  let ctx: TestContext<StoreTestComponent>;
  let fileService: FileManagementService;

  const setup = SETUP(StoreTestComponent);

  let getFilesSpy: jasmine.Spy;

  beforeEach(() => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
    getFilesSpy = spyOn(fileService, "getFiles");
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [],
        applications: []
      }));
  });

  it("Initialize action should be successful", async () => {

    ctx.store.dispatch(new BackendActions.Initialize({ redirectUrl: "/redirect-to" }));

    await ctx.asyncWait();

    expect(ctx.backendState().redirectUrl).toEqual("/redirect-to");

    expect(ctx.routerStub.value).toEqual(["/init"]);
  });

  it("Initialized action should be successful", async () => {

    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1],
        applications: ["app1", "app2"]
      }));

    const principal: Principal = {
      user: TEST_USER,
      repoMetadata: {} as any
    };
    ctx.store.dispatch(new BackendActions.Initialized({ principal }));

    await ctx.asyncWait();

    expect(ctx.routerStub.value).toEqual(["/dashboard"]);

    expect(reducer.getPrincipal(ctx.backendState())).toEqual(principal);

    // Initialized action should trigger load files
    expect(reducer.getAllFiles(ctx.backendState())).toEqual({
      app1: [file1],
      app2: []
    });
    expect(reducer.getApplications(ctx.backendState())).toEqual(["app1", "app2"]);
    expect(reducer.getConfigFile(ctx.backendState(), file1.fileName, file1.applicationName)).toEqual(file1);
    expect(reducer.getConfigFile(ctx.backendState(), file2.fileName, file2.applicationName)).toBeUndefined();
  });

  it("LoadFiles action should be successful", async () => {

    // Get one file
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities).toEqual({ "app1/test1.yaml": file1 });

    // Get two files
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1, file2],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities).toEqual({
      "app1/test1.yaml": file1,
      "app1/test2.yaml": file2
    });

    // Get three files
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1, file2, file3],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities).toEqual({
      "app1/test1.yaml": file1,
      "app1/test2.yaml": file2,
      "app1/test3.yaml": file3
    });

    // Change oids
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [{ ...file1, oid: "111111" }, { ...file2, oid: undefined }, { ...file3, oid: "newoid" }],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/test1.yaml"].oid).toEqual("111111");
    expect(ctx.backendState().files.entities["app1/test2.yaml"].oid).toBeUndefined();
    expect(ctx.backendState().files.entities["app1/test3.yaml"].oid).toEqual("newoid");
    _.each(ctx.backendState().files.entities, file => {
      expect(file.draftConfig).toBeUndefined();
      expect(file.originalConfig).toBeUndefined();
    });

    // Some file removed
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file2, file3],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities).toEqual({
      "app1/test2.yaml": file2,
      "app1/test3.yaml": file3,
    });
  });

  it("LoadFiles action fail, alert dialog should show", async () => {
    getFilesSpy.and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("GetFileContent action should be successful", async () => {
    // Load files at first
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1, file2],
        applications: ["app1"]
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities).toEqual({
      "app1/test1.yaml": file1,
      "app1/test2.yaml": file2
    });

    const getFileContentSpy = spyOn(fileService, "getFileContent");

    // Get one file content
    getFileContentSpy.and.returnValue(Promise.resolve({
        fileName: "test1.yaml",
        applicationName: "app1",
        draftConfig: new Configuration(),
      }));

    ctx.store.dispatch(new BackendActions.GetFileContent({ fileName: "test1.yaml", applicationName: "app1" }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/test1.yaml"]).toEqual({ ...file1, draftConfig: new Configuration() });

    // Get second file content
    getFileContentSpy.and.returnValue(Promise.resolve({
        fileName: "test2.yaml",
        applicationName: "app1",
        oid: "222222",
        originalConfig: new Configuration()
      }));

    ctx.store.dispatch(new BackendActions.GetFileContent({ fileName: "test2.yaml", applicationName: "app1" }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/test2.yaml"]).toEqual({ ...file2, originalConfig: new Configuration() });
  });

  it("GetFileContentSuccess action should not insert for newly created file", async () => {

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1, newlyCreated: true }));
    await ctx.asyncWait();

    expect(ctx.backendState().files.ids.length).toEqual(0);
  });

  it("GetFileContent action fail, alert dialog should show", async () => {
    spyOn(fileService, "getFileContent").and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.GetFileContent(file1));
    await ctx.asyncWait();
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("SaveDraft action should be successful", async () => {
    // Get one file
    getFilesSpy.and.returnValue(Promise.resolve({
        files: [file1],
        applications: ["app1"],
        appConfigs: { app1: {} }
      }));

    ctx.store.dispatch(new BackendActions.LoadFiles());
    await ctx.asyncWait();

    const saveDraftSpy = spyOn(fileService, "saveDraft");

    saveDraftSpy.and.returnValue(Promise.resolve(file1));

    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file1, redirect: true }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/test1.yaml"]).toEqual(file1);
    expect(ctx.backendState().appConfigs).toEqual({ app1: {} });

    expect(ctx.routerStub.value).toEqual(["/dashboard"]);

    saveDraftSpy.and.returnValue(Promise.resolve(file4));

    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file4, redirect: true }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/.percyrc"]).toEqual(file4);
    expect(ctx.backendState().appConfigs).toEqual({ app1: percyConfig });
  });

  it("SaveDraft action should be successful without redirect", async () => {
    spyOn(fileService, "saveDraft").and.returnValue(Promise.resolve(file1));

    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file1, redirect: false }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.entities["app1/test1.yaml"]).toEqual(file1);

    expect(ctx.routerStub.value).toBeUndefined();
  });

  it("SaveDraft action fail, alert dialog should show", async () => {

    spyOn(fileService, "saveDraft").and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file1, redirect: true }));
    await ctx.asyncWait();
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("CommitChanges action should be successful", async () => {
    spyOn(fileService, "commitFiles").and.returnValue(Promise.resolve([file1]));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], message: "test commit", fromEditor: true }));
    await ctx.asyncWait();

    expect(ctx.backendState().files.ids.length).toEqual(2);
    expect(ctx.backendState().files.entities).toEqual({ "app1/test1.yaml": file1,  "app1/test2.yaml": file2 });
    expect(ctx.routerStub.value).toEqual(["/dashboard"]);
  });

  it("CommitChanges action should be successful to resovel conflicts", async () => {
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    spyOn(fileService, "commitFiles").and.callFake(() => {
      const error = new HttpErrors.Conflict("conflict error");
      error.data = [file1];
      throw error;
    });

    spyOn(fileService, "resovelConflicts").and.returnValue(Promise.resolve([file1, file2]));

    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [file1, file2], message: "test commit", fromEditor: false }));
    await ctx.asyncWait();

    assertDialogOpened(ConflictDialogComponent, {
      data: {
        conflictFiles: [file1],
      }
    });

    ctx.dialogStub.output.next([file1]);
    await ctx.asyncWait();

    expect(ctx.backendState().files.ids.length).toEqual(2);
    expect(ctx.routerStub.value).toBeUndefined();
  });

  it("CommitChanges action fail, alert dialog should show", async () => {

    spyOn(fileService, "commitFiles").and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], message: "test commit", fromEditor: true }));
    await ctx.asyncWait();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("DeleteFile action should be successful", async () => {
    spyOn(fileService, "deleteFile").and.returnValue(Promise.resolve(true));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    await ctx.asyncWait();
    expect(ctx.backendState().files.ids.length).toEqual(1);

    ctx.store.dispatch(new BackendActions.DeleteFile(file1));
    await ctx.asyncWait();
    expect(ctx.backendState().files.ids.length).toEqual(1);

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: `${file1.applicationName}/${file1.fileName} is deleted successfully.`,
        alertType: "delete"
      }
    });
  });

  it("DeleteFile action should be successful without pull", async () => {
    spyOn(fileService, "deleteFile").and.returnValue(Promise.resolve(true));

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    expect(ctx.backendState().files.ids.length).toEqual(1);

    ctx.store.dispatch(new BackendActions.DeleteFile(file1));
    await ctx.asyncWait();
    expect(ctx.backendState().files.ids.length).toEqual(0);

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: `${file1.applicationName}/${file1.fileName} is deleted successfully.`,
        alertType: "delete"
      }
    });
  });

  it("DeleteFile action fail, alert dialog should show", async () => {

    spyOn(fileService, "deleteFile").and.throwError("Mock error");
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.DeleteFile(file1));
    await ctx.asyncWait();
    expect(ctx.backendState().files.ids.length).toEqual(2);

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("Refresh action should be successful", async () => {
    spyOn(fileService, "refresh").and.returnValue(Promise.resolve({ branchChanged: true, masterChanged: false, pulledCommit: "" }));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.Refresh());
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.dashboarState().refreshing).toBeFalsy();
    expect(ctx.backendState().files.ids.length).toEqual(2);
  });

  it("Refresh action should be successful without change", async () => {
    spyOn(fileService, "refresh").and.returnValue(Promise.resolve({ branchChanged: false, masterChanged: false, pulledCommit: "" }));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.Refresh());
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.backendState().files.ids.length).toEqual(0);
    expect(ctx.dashboarState().refreshing).toBeFalsy();
  });

  it("Refresh action fail, alert dialog should show", async () => {
    spyOn(fileService, "refresh").and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.Refresh());
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.dashboarState().refreshing).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("Refresh while current branch deleted, should switch to master", async () => {
    spyOn(fileService, "refresh").and.callFake(() => {
      const err = new Error(`Branch has been deleted in remote repo`);
      err["currentBranchDeleted"] = true;
      throw err;
    });
    spyOn(fileService, "checkoutBranch").and.throwError("Mock checkout error");

    ctx.store.dispatch(new BackendActions.Refresh());
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.dashboarState().refreshing).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock checkout error",
        alertType: "error"
      }
    });
  });

  it("Checkout action should be successful", async () => {
    spyOn(fileService, "checkoutBranch").and.returnValue(Promise.resolve());
    getFilesSpy.and.returnValues(
      Promise.resolve({ files: [], applications: [] }),
      Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new AuthActions.LoginSuccess(TEST_USER));

    const principal: Principal = {
      user: { ...TEST_USER },
      repoMetadata: { ...TEST_USER, version: "1.0", commitBaseSHA: {} }
    };
    ctx.store.dispatch(new BackendActions.Initialized({ principal }));

    await ctx.asyncWait();

    expect(ctx.backendState().files.ids.length).toEqual(0);

    ctx.store.dispatch(new BackendActions.Checkout({ type: "create", branch: "some-branch" }));
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.dashboarState().refreshing).toBeFalsy();
    expect(ctx.backendState().principal.user.branchName).toEqual("some-branch");
    expect(ctx.backendState().principal.repoMetadata.branchName).toEqual("some-branch");
    expect(ctx.authState().currentUser.branchName).toEqual("some-branch");
    expect(ctx.backendState().files.ids.length).toEqual(2);
  });

  it("Checkout action fail, alert dialog should show", async () => {
    spyOn(fileService, "checkoutBranch").and.throwError("Mock error");

    ctx.store.dispatch(new BackendActions.Checkout({ type: "create", branch: "some-branch" }));
    expect(ctx.dashboarState().refreshing).toBeTruthy();

    await ctx.asyncWait();

    expect(ctx.dashboarState().refreshing).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "error"
      }
    });
  });

  it("Merge branch action should be successful", async () => {
    const mergeBranchSpy = spyOn(fileService, "mergeBranch");

    getFilesSpy.and.returnValue(
      Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.MergeBranch(
      { srcBranch: "master", targetBranch: "some-branch", diff: { toSave: [file1], toDelete: [] } }));
    expect(ctx.dashboarState().committingFile).toBeTruthy();

    await ctx.asyncWait();

    expect(mergeBranchSpy.calls.count()).toEqual(1);
    expect(ctx.dashboarState().committingFile).toBeFalsy();
    expect(ctx.backendState().files.ids.length).toEqual(2);
  });

  it("Merge branch action should be successful without diff", async () => {
    const mergeBranchSpy = spyOn(fileService, "mergeBranch");
    spyOn(fileService, "refresh").and.returnValue(Promise.resolve({ branchChanged: false, masterChanged: false, pulledCommit: "" }));
    spyOn(fileService, "branchDiff").and.returnValue(Promise.resolve({ toSave: [], toDelete: [], conflictFiles: [] }));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.MergeBranch({ srcBranch: "master", targetBranch: "some-branch" }));
    expect(ctx.dashboarState().committingFile).toBeTruthy();

    await ctx.asyncWait();
    await ctx.asyncWait();

    expect(mergeBranchSpy.calls.count()).toEqual(0);
    expect(ctx.dashboarState().committingFile).toBeFalsy();
    expect(ctx.backendState().files.ids.length).toEqual(2);
  });

  it("Merge branch action should resolve conflicts successfully", async () => {
    const mergeBranchSpy = spyOn(fileService, "mergeBranch");
    spyOn(fileService, "refresh").and.returnValue(Promise.resolve({ branchChanged: false, masterChanged: false, pulledCommit: "" }));
    spyOn(fileService, "branchDiff").and.returnValue(Promise.resolve({ toSave: [file1], toDelete: [], conflictFiles: [file2] }));
    getFilesSpy.and.returnValue(Promise.resolve({ files: [file1, file2], applications: ["app1"] }));

    ctx.store.dispatch(new BackendActions.MergeBranch({ srcBranch: "master", targetBranch: "some-branch" }));
    expect(ctx.dashboarState().committingFile).toBeTruthy();

    await ctx.asyncWait();

    assertDialogOpened(ConflictDialogComponent, {
      data: {
        diff: { toSave: [file1], toDelete: [] },
        conflictFiles: [file2],
        srcBranch: "master",
        targetBranch: "some-branch"
      }
    });

    ctx.dialogStub.output.next([file2]);
    await ctx.asyncWait();

    expect(mergeBranchSpy.calls.count()).toEqual(1);
    expect(ctx.dashboarState().committingFile).toBeFalsy();
    expect(ctx.backendState().files.ids.length).toEqual(2);
  });

  it("Merge branch fail, alert dialog should show", async () => {
    const mergeBranchSpy = spyOn(fileService, "mergeBranch");
    mergeBranchSpy.and.throwError("Mock merge error");

    ctx.store.dispatch(new BackendActions.MergeBranch(
      { srcBranch: "master", targetBranch: "some-branch", diff: { toSave: [file1], toDelete: [] } }));
    expect(ctx.dashboarState().committingFile).toBeTruthy();

    await ctx.asyncWait();

    expect(mergeBranchSpy.calls.count()).toEqual(1);
    expect(ctx.dashboarState().committingFile).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock merge error",
        alertType: "error"
      }
    });
  });
});
