import { Setup, assertDialogOpened, TestContext, utilService } from "test/test-helper";
import * as _ from "lodash";

import { PROPERTY_VALUE_TYPES, appPercyConfig } from "config";
import { TreeNode } from "models/tree-node";
import { Configuration } from "models/config-file";
import { Alert } from "store/actions/common.actions";

import { PageLoadSuccess, ConfigurationChange } from "store/actions/editor.actions";
import { LoadFilesSuccess, GetFileContentSuccess } from "store/actions/backend.actions";

import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";

import { EditorComponent } from "./editor.component";

describe("EditorComponent", () => {
  const setup = Setup(EditorComponent);

  const file = {
    applicationName: "app1",
    fileName: "sample.yaml",
    oid: "111111",
  };
  const applications = ["app1", "app2", "app3"];

  let ctx: TestContext<EditorComponent>;
  let dispatchSpy: jasmine.Spy;

  beforeEach(() => {
    ctx = setup();
    const backup = ctx.store.dispatch;
    dispatchSpy = spyOn(ctx.store, "dispatch");
    dispatchSpy.and.callFake((action) => {
      if (action instanceof Alert || action instanceof ConfigurationChange) {
        return backup.apply(ctx.store, [action]);
      }
    });
  });

  it("should create EditorComponent", () => {
    expect(ctx.component).toBeTruthy();
    expect(ctx.component.getAppConfigTooltip()).toEqual(utilService.getAppConfigTooltip(appPercyConfig));
  });

  it("should init EditorComponent with edit file mode", () => {
    ctx.component.editMode = true;
    ctx.component.appName = "app1";
    ctx.component.fileName = "test.yaml";
    ctx.component.environments = ["dev"];
    ctx.component.configuration = new Configuration();

    ctx.component.ngOnChanges({
      fileName: <any>{}
    });

    expect(ctx.component.filename.value).toEqual("test.yaml");

    expect(ctx.component.filename.disabled).toBeTruthy();

  });

  it("should init EditorComponent with new file mode", async () => {
    ctx.component.editMode = false;
    ctx.component.appName = "app1";
    ctx.component.fileName = null;
    ctx.component.environments = ["dev"];
    ctx.component.configuration = new Configuration();

    ctx.component.ngOnChanges({
      fileName: <any>{}
    });

    const focusSpy = spyOn(ctx.component.fileNameInput, "focus");

    await new Promise((resolve) => {
      setImmediate(async () => {
        await expect(focusSpy.calls.count()).toEqual(1);
        resolve();
      });
    });

    ctx.component.filename.setValue("");
    expect(ctx.component.filename.valid).toBeFalsy();

    ctx.component.filename.setValue("new.yaml");
    expect(ctx.component.filename.valid).toBeTruthy();
  });

  const newFile = {
    fileName: null,
    applicationName: "app1",
    draftConfig: new Configuration(),
    modified: true
  };

  async function initNewFileMode() {
    ctx.component.editMode = false;
    ctx.component.appName = "app1";
    ctx.component.fileName = null;
    ctx.component.environments = ["dev"];
    ctx.component.configuration = new Configuration();

    ctx.store.next(new LoadFilesSuccess({ files: [file], applications, appConfigs: {} }));
    ctx.store.next(new PageLoadSuccess({ environments: ["dev"] }));
    ctx.store.next(new GetFileContentSuccess({file: newFile, newlyCreated: true}));

    ctx.component.ngOnChanges({
      fileName: <any>{}
    });
    await ctx.fixture.whenStable();
  }

  it("should not change to existing file name", async () => {
    await initNewFileMode();

    ctx.component.filename.setValue(file.fileName.replace("\.yaml", ""));
    expect(ctx.component.filename.valid).toBeFalsy();
    expect(ctx.component.filename.hasError("alreadyExists")).toBeTruthy();
  });

  it("should validate properly if file name is invalid", async () => {
    await initNewFileMode();
    const focusSpy = spyOn(ctx.component.fileNameInput, "focus");

    ctx.component.filename.setValue("");
    expect(ctx.component.filename.valid).toBeFalsy();

    const result = await ctx.component.validate().toPromise();
    expect(result.valid).toBeFalsy();

    expect(focusSpy.calls.any()).toBeTruthy();
  });

  it("should validate properly if yaml config is invalid", async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode("key1", PROPERTY_VALUE_TYPES.STRING, utilService.constructVariable("key1")));
    config.environments.addChild(new TreeNode("dev"));

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue("test.yaml");

    const result = await ctx.component.validate().toPromise();
    expect(result.valid).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: { message: `YAML validation failed:\nLoop variable reference: key1->key1`, alertType: "error" },
    });
  });

  it("should validate properly if file name and yaml config are valid", async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode("key1", PROPERTY_VALUE_TYPES.STRING, "aaa"));
    config.default.addChild(new TreeNode("key2", PROPERTY_VALUE_TYPES.STRING, "bbb"));
    config.environments.addChild(new TreeNode("dev"));

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue("test.yaml");

    const result = await ctx.component.validate().toPromise();
    expect(result.valid).toBeTruthy();
  });

  it("select a leaf node should work", () => {
    const node = new TreeNode("key", PROPERTY_VALUE_TYPES.STRING, "value");

    ctx.component.onNodeSelected(node);

    expect(ctx.component.selectedNode).toEqual(node);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  });

  it("select an object node should work", () => {
    const node = new TreeNode("obj", PROPERTY_VALUE_TYPES.OBJECT);
    node.addChild(new TreeNode("key", PROPERTY_VALUE_TYPES.STRING, "value"));

    ctx.component.onNodeSelected(node);

    expect(ctx.component.selectedNode).toEqual(node);
    expect(ctx.component.showAsCode).toEqual(true);
    expect(ctx.component.previewCode).toEqual("obj: !!map\n  key: !!str \"value\"");
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  });

  it("add/edit proprty should work", () => {
    const configProperty: any = {};

    ctx.component.onAddEditProperty(configProperty);

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(configProperty);

    ctx.component.onCancelAddEditProperty();

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  });

  it("open edit proprty should work", () => {
    const spy = jasmine.createSpyObj("", ["openEditPropertyDialog"]);
    ctx.component.nestedConfig = spy;

    const node = new TreeNode("key");
    ctx.component.openEditPropertyDialog(node);

    expect(spy.openEditPropertyDialog.calls.mostRecent().args[0]).toEqual(node);
  });

  it("save proprty should work", () => {
    const spy = jasmine.createSpyObj("", ["saveAddEditProperty"]);
    spy.saveAddEditProperty.and.returnValue(true);
    ctx.component.nestedConfig = spy;

    const node = new TreeNode("key");
    ctx.component.onSaveAddEditProperty(node);
  });

  it("show compiled YAML should work", async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode("key1", PROPERTY_VALUE_TYPES.STRING, "aaa"));
    config.default.addChild(new TreeNode("key2", PROPERTY_VALUE_TYPES.STRING, "bbb"));
    config.environments.addChild(new TreeNode("dev"));

    ctx.component.onConfigChange(config);

    ctx.component.showCompiledYAML("dev");

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual("key1: !!str \"aaa\"\nkey2: !!str \"bbb\"");
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual("dev");
    expect(ctx.component.currentConfigProperty).toEqual(null);
  });

  it("show compiled YAML should alert error if yaml is invalid", async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode("key1", PROPERTY_VALUE_TYPES.STRING, utilService.constructVariable("key1")));
    config.environments.addChild(new TreeNode("dev"));

    ctx.component.onConfigChange(config);

    ctx.component.showCompiledYAML("dev");

    assertDialogOpened(AlertDialogComponent, {
      data: { message: "Loop variable reference: key1->key1", alertType: "error" },
    });
  });

});
