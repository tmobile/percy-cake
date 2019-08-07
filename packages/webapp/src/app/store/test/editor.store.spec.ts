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

import { ConfigFile, Configuration, FileTypes } from "models/config-file";
import * as BackendActions from "../actions/backend.actions";
import { FileManagementService } from "services/file-management.service";
import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";

import { percyConfig, appPercyConfig } from "config";
import { StoreTestComponent, Setup, TestContext, assertDialogOpened } from "test/test-helper";
import { TreeNode } from "models/tree-node";
import { PageLoad, ConfigurationChange, FileContentChange } from "../actions/editor.actions";
import * as reducer from "../reducers/editor.reducer";

const percyFileContent = JSON.stringify({ key: "value" });

const file1: ConfigFile = {
  fileName: "test1.yaml",
  applicationName: "app1",
  fileType: FileTypes.YAML,
  modified: true,
  oid: "111111",
  draftConfig: new Configuration(),
  originalConfig: new Configuration(),
};

const file2: ConfigFile = {
  fileName: "test1.yaml",
  applicationName: "app1",
  fileType: FileTypes.YAML,
  modified: false,
  oid: "222222",
  originalConfig: new Configuration(),
};

const file3: ConfigFile = {
  fileName: "test.md",
  applicationName: "app1",
  fileType: FileTypes.MD,
  modified: false,
  oid: "333333",
  originalContent: "original",
};

const file4: ConfigFile = {
  fileName: ".percyrc",
  applicationName: percyConfig.yamlAppsFolder,
  fileType: FileTypes.PERCYRC,
  modified: false,
  oid: "444444",
  originalContent: percyFileContent,
};

const file5: ConfigFile = {
  fileName: "test2.md",
  applicationName: "",
  fileType: FileTypes.MD,
  modified: true,
  oid: "555555",
  draftContent: "draft",
  originalContent: "original",
};

fdescribe("Editor store action/effect/reducer", () => {
  let ctx: TestContext<StoreTestComponent>;
  let fileService: FileManagementService;

  const setup = Setup(StoreTestComponent);

  beforeEach(() => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, "getFiles").and.returnValue({ files: [file1], applications: ["app1"] });
    spyOn(fileService, "commitFiles").and.returnValue([file1]);
    spyOn(fileService, "saveDraft").and.returnValue(file1);
    spyOn(fileService, "deleteFile").and.returnValue(false);
  });

  it("PageLoad action should be successful for add new yaml file mode", async () => {
    const spy = spyOn(fileService, "getEnvironments");

    spy.and.returnValue({ environments: ["dev", "prod"], appPercyConfig: { key: "value" } });

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "app1", editMode: false, fileType: FileTypes.YAML }));
    expect(ctx.editorState().editMode).toBeFalsy();
    await ctx.fixture.whenStable();
    await ctx.fixture.whenStable();

    const file: ConfigFile = {
      fileName: null,
      applicationName: "app1",
      fileType: FileTypes.YAML,
      draftConfig: new Configuration(),
      draftContent: null,
      modified: true
    };
    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file);
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file.draftConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toBeTruthy();
    expect(appPercyConfig).toEqual({ key: "value" });

    expect(reducer.getEnvironments(ctx.editorState())).toEqual(["dev", "prod"]);
  });

  it("PageLoad action should be successful for add new non yaml file mode", async () => {
    const spy = spyOn(fileService, "getEnvironments");

    spy.and.returnValue({ environments: ["dev", "prod"], appPercyConfig: { key: "value" } });

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "", editMode: false, fileType: FileTypes.MD }));
    expect(ctx.editorState().editMode).toBeFalsy();
    await ctx.fixture.whenStable();
    await ctx.fixture.whenStable();

    const file: ConfigFile = {
      fileName: null,
      applicationName: "",
      fileType: FileTypes.MD,
      draftContent: "",
      draftConfig: null,
      modified: true
    };
    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file);
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toBeTruthy();
    expect(appPercyConfig).toEqual({ key: "value" });

    expect(reducer.getEnvironments(ctx.editorState())).toEqual(["dev", "prod"]);
  });

  it("PageLoad action should be successful for edit yaml file mode", async () => {
    const spy = spyOn(fileService, "getEnvironments");
    spy.and.returnValue({ environments: ["dev", "prod"], appPercyConfig: { key1: "value1" } });

    const file: ConfigFile = {
      fileName: "test.yaml", applicationName: "app1", fileType: FileTypes.YAML, originalConfig: new Configuration()
    };
    spyOn(fileService, "getFileContent").and.returnValue(file);

    ctx.store.dispatch(new PageLoad({ fileName: "test.yaml", applicationName: "app1", editMode: true, fileType: FileTypes.YAML }));
    expect(ctx.editorState().editMode).toBeTruthy();
    await ctx.fixture.whenStable();
    await ctx.fixture.whenStable();

    expect(reducer.getEnvironments(ctx.editorState())).toEqual(["dev", "prod"]);

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file);
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file.originalConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toBeFalsy();
    expect(appPercyConfig).toEqual({ key1: "value1" });
  });

  it("PageLoad action should be successful for edit non yaml file mode", async () => {
    const spy = spyOn(fileService, "getEnvironments");
    spy.and.returnValue({ environments: ["dev", "prod"], appPercyConfig: { key1: "value1" } });

    const file: ConfigFile = {
      fileName: "test.md", applicationName: "app1", fileType: FileTypes.MD, originalContent: "original"
    };
    spyOn(fileService, "getFileContent").and.returnValue(file);

    ctx.store.dispatch(new PageLoad({ fileName: "test.md", applicationName: "app1", editMode: true, fileType: FileTypes.MD }));
    expect(ctx.editorState().editMode).toBeTruthy();
    await ctx.fixture.whenStable();
    await ctx.fixture.whenStable();

    expect(reducer.getEnvironments(ctx.editorState())).toEqual(["dev", "prod"]);

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file);
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toBeFalsy();
    expect(appPercyConfig).toEqual({ key1: "value1" });
  });

  it("PageLoad action should be successful for edit file mode, file content already loaded in state", async () => {
    const file: ConfigFile = {
      fileName: "test.yaml", applicationName: "app1", fileType: FileTypes.YAML, originalConfig: new Configuration()
    };
    ctx.store.next(new BackendActions.LoadFilesSuccess({ files: [file], applications: ["app1"], appConfigs: {} }));

    const spy = spyOn(fileService, "getEnvironments");
    spy.and.returnValue({ environments: ["dev", "prod"], appPercyConfig: { key1: "value1" } });

    const getFileContentSyp = spyOn(fileService, "getFileContent");

    ctx.store.dispatch(new PageLoad({ fileName: "test.yaml", applicationName: "app1", editMode: true, fileType: FileTypes.YAML }));
    expect(ctx.editorState().editMode).toBeTruthy();
    await ctx.fixture.whenStable();
    await ctx.fixture.whenStable();

    expect(reducer.getEnvironments(ctx.editorState())).toEqual(["dev", "prod"]);

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file);
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file.originalConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toBeFalsy();
    expect(appPercyConfig).toEqual({ key1: "value1" });

    expect(getFileContentSyp.calls.count()).toEqual(0);
  });

  it("PageLoad action fail, alert dialog should show", async () => {

    spyOn(fileService, "getEnvironments").and.throwError("Mock error");

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "app1", editMode: true, fileType: FileTypes.YAML }));
    await ctx.fixture.whenStable();
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: "Mock error",
        alertType: "go-to-dashboard"
      }
    });
  });

  it("GetFileContentSuccess action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.draftConfig);
    expect(reducer.getConfiguration(ctx.editorState()) !== file1.draftConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file2 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file2);
    expect(reducer.getConfigFile(ctx.editorState()) !== file2).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file2.originalConfig);
    expect(reducer.getConfiguration(ctx.editorState()) !== file2.originalConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file3 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file3);
    expect(reducer.getConfigFile(ctx.editorState()) !== file3).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file4 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file4);
    expect(reducer.getConfigFile(ctx.editorState()) !== file4).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file5 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file5);
    expect(reducer.getConfigFile(ctx.editorState()) !== file5).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);
  });

  it("ConfigurationChange action should be successful", async () => {
    spyOn(fileService, "getEnvironments").and.returnValue(["dev", "prod"]);
    const newConfig = new Configuration();
    newConfig.default.addChild(new TreeNode("key"));

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "app1", editMode: false, fileType: FileTypes.YAML }));
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    ctx.store.dispatch(new ConfigurationChange(newConfig));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual({ ...file1, modified: true });
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(newConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "app1", editMode: true, fileType: FileTypes.YAML }));
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file2 }));
    ctx.store.dispatch(new ConfigurationChange(newConfig));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual({ ...file2, modified: true });
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(newConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);
  });

  it("FileContentChange action should be successful", async () => {
    spyOn(fileService, "getEnvironments").and.returnValue(["dev", "prod"]);

    ctx.store.dispatch(new PageLoad({ fileName: null, applicationName: "", editMode: false, fileType: FileTypes.MD }));
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file5 }));
    ctx.store.dispatch(new FileContentChange("new content"));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual({ ...file5, modified: true });
    expect(reducer.getConfiguration(ctx.editorState())).toBeNull();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);
  });

  it("SaveDraft action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file1, redirect: false }));
    expect(reducer.isSaving(ctx.editorState())).toEqual(true);
  });

  it("SaveDraftSuccess action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.SaveDraftSuccess(file1));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfigFile(ctx.editorState()).draftConfig !== file1.draftConfig).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.draftConfig);
    expect(reducer.getConfiguration(ctx.editorState()) === file1.draftConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);

    ctx.store.dispatch(new BackendActions.SaveDraftSuccess(file5));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file5);
    expect(reducer.getConfigFile(ctx.editorState()) !== file5).toBeTruthy();
    expect(reducer.getConfigFile(ctx.editorState()).draftContent === file5.draftContent).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toBeUndefined();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it("SaveDraftFailure action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.SaveDraftFailure(new Error("Mock error")));
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it("CommitChanges action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: false, message: "" }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(false);
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: true, message: "" }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);
  });

  it("CommitChangesSuccess action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({ files: [], fromEditor: false }));
    expect(reducer.getConfigFile(ctx.editorState())).toEqual(null);

    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({ files: [file1], fromEditor: true }));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfigFile(ctx.editorState()).originalConfig !== file1.originalConfig).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.originalConfig);
    expect(reducer.getConfiguration(ctx.editorState()) === file1.originalConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);

    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({ files: [file3], fromEditor: true }));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file3);
    expect(reducer.getConfigFile(ctx.editorState()) !== file3).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toBeUndefined();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it("CommitChangesFailure action should be successful", async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: true, message: "" }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.CommitChangesFailure(
      { error: new Error("mock error"), files: [], fromEditor: false, commitMessage: "" }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.CommitChangesFailure(
      { error: new Error("mock error"), files: [], fromEditor: true, commitMessage: "" }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(false);
  });
});
