import { Setup, TestContext } from "test/test-helper";

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

    await new Promise(resolve => setTimeout(resolve, 150)); // wait for debouce time
    expect(ctx.observables.filteredApps.value).toEqual(data.applications);
    expect(ctx.component.createEnv.disabled).toBeFalsy();

    // Shouldn't close without app selected
    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toBeUndefined();

    ctx.component.appname.setValue("app3");
    await new Promise(resolve => setTimeout(resolve, 150)); // wait for debouce time
    expect(ctx.observables.filteredApps.value).toEqual([]);

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ appName: "app3", createEnv: false });
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

    await new Promise(resolve => setTimeout(resolve, 150)); // wait for debouce time
    expect(ctx.observables.filteredApps.value).toEqual(data.applications);

    ctx.component.createEnv.setValue(true);

    ctx.component.selectApp();
    expect(ctx.dialogStub.output.value).toEqual({ appName: "app2", createEnv: true });
  });
});
