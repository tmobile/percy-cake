import { SETUP, TestContext } from "test/test-helper";

import { percyConfig } from "config";
import { FileTypes } from "models/config-file";

import { SelectAppDialogComponent } from "./select-app-dialog.component";

describe("SelectAppDialogComponent", () => {

  const setup = SETUP(SelectAppDialogComponent, false);

  let ctx: TestContext<SelectAppDialogComponent>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should create SelectAppDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("initialize with non app selected", async () => {
    // Init component
    const data = {
      selectedApp: "",
      applications: ["app1", "app2"],
      envFileName: "environments.yaml",
      files: [
        {
          fileName: "environments.yaml",
          applicationName: "app1"
        },
        {
          fileName: ".percyrc",
          applicationName: "app1"
        }
      ],
    };
    ctx.component.data = data;
    ctx.detectChanges();

    expect(ctx.component.baseFolderOptions).toEqual(["", percyConfig.yamlAppsFolder, "application"]);
    expect(ctx.component.hasPercyrc).toEqual(["app1"]);
    expect(ctx.component.fileType.value).toEqual(FileTypes.YAML);

    expect(ctx.component.filteredApps).toEqual(data.applications);
    expect(ctx.component.createEnv.disabled).toBeFalsy();

    // Shouldn't close without app selected
    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toBeUndefined();

    ctx.component.appname.setValue("app2");

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ fileType: FileTypes.YAML, appName: "app2", createEnv: false });

    // select filetype as percyrc
    ctx.component.fileType.setValue(FileTypes.PERCYRC);
    expect(ctx.component.appname.value).toEqual("");
    expect(ctx.component.baseFolderOptions).toEqual([percyConfig.yamlAppsFolder, "application"]);
    expect(ctx.component.filteredApps).toEqual(["app2"]);
    expect(ctx.component.baseFolder.value).toEqual(percyConfig.yamlAppsFolder);

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({
      fileType: FileTypes.PERCYRC, appName: percyConfig.yamlAppsFolder, createEnv: false
    });

    ctx.component.baseFolder.setValue("application");
    ctx.component.appname.setValue("app2");

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ fileType: FileTypes.PERCYRC, appName: "app2", createEnv: false });

    // select filetype as percyrc
    ctx.component.fileType.setValue(FileTypes.MD);
    expect(ctx.component.appname.value).toEqual("");
    expect(ctx.component.baseFolderOptions).toEqual(["", percyConfig.yamlAppsFolder, "application"]);
    expect(ctx.component.filteredApps).toEqual(data.applications);
    expect(ctx.component.baseFolder.value).toEqual("");
  });

  it("initialize with selected app", async () => {
    // Init component
    const data = {
      selectedApp: "app1",
      applications: ["app1", "app2"],
      envFileName: "environments.yaml",
      files: [
        {
          fileName: "environments.yaml",
          applicationName: "app1"
        }
      ],
    };
    ctx.component.data = data;
    ctx.detectChanges();

    expect(ctx.component.appname.value).toEqual(data.selectedApp);
    expect(ctx.component.createEnv.disabled).toBeTruthy();

    ctx.component.appname.setValue("app2");
    expect(ctx.component.createEnv.disabled).toBeFalsy();

    expect(ctx.component.filteredApps).toEqual(data.applications);

    ctx.component.createEnv.setValue(true);

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ fileType: FileTypes.YAML, appName: "app2", createEnv: true });
  });
});
