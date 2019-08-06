import { Setup, TestContext } from "test/test-helper";

import { percyConfig } from "config";
import { FileTypes } from "models/config-file";

import { SelectAppDialogComponent } from "./select-app-dialog.component";

describe("SelectAppDialogComponent", () => {

  const setup = Setup(SelectAppDialogComponent, false);

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
        }
      ],
    };
    ctx.component.data = data;
    ctx.detectChanges();

    // default base folder options
    expect(ctx.component.baseFolderOptions).toEqual(["", percyConfig.yamlAppsFolder, "application"]);

    // default file type selected
    expect(ctx.component.fileType.value).toEqual(FileTypes.YAML);

    expect(ctx.component.filteredApps).toEqual(data.applications);
    expect(ctx.component.createEnv.disabled).toBeFalsy();

    // Shouldn't close without app selected
    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toBeUndefined();

    ctx.component.appname.setValue("app3");

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ fileType: FileTypes.YAML, appName: "app3", createEnv: false });
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
