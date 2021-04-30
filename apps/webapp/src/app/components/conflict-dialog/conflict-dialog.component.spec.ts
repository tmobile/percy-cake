import { SETUP, TestContext, utilService } from "test/test-helper";

import { ConflictDialogComponent } from "./conflict-dialog.component";
import { Configuration, ConflictFile } from "models/config-file";

describe("ConflictDialogComponent", () => {
  const setup = SETUP(ConflictDialogComponent, false);

  const draftConfig = new Configuration();
  const draftContent = utilService.convertTreeToYaml(draftConfig);
  const originalConfig = new Configuration();
  const originalContent = utilService.convertTreeToYaml(originalConfig);


  const conflictFile: ConflictFile = {
    fileName: "sample.yaml",
    applicationName: "app1",
    draftConfig,
    draftContent,
    originalConfig,
    originalContent,
  };

  let ctx: TestContext<ConflictDialogComponent>;

  let data;
  beforeEach(() => {
    ctx = setup();
    data = {
      conflictFiles: [{...conflictFile}],
    };
  });

  it("should create ConflictDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should show conflicted files to resolve conflicts", async () => {

    ctx.component.data = data;
    ctx.detectChanges();
    await ctx.asyncWait();

    expect(ctx.component.fileIdx).toEqual(0);
    expect(ctx.component.allResolved()).toBeFalsy();

    ctx.component.resolveConflict({ value: "draft" }, data.conflictFiles[0]);
    ctx.detectChanges();
    await ctx.asyncWait();
    expect(ctx.component.allResolved()).toBeTruthy();

    ctx.component.resolveConflict({ value: "repo" }, data.conflictFiles[0]);
    ctx.detectChanges();
    await ctx.asyncWait();
    expect(ctx.component.allResolved()).toBeTruthy();
  }, 10000);

  it("should confirm to use draft and recommit", async () => {

    ctx.component.data = data;
    ctx.detectChanges();
    await ctx.asyncWait();

    ctx.component.resolveConflict({ value: "draft" }, data.conflictFiles[0]);
    ctx.component.confirmAction();

    ctx.detectChanges();
    await ctx.asyncWait();
    const dialogOutput = ctx.dialogStub.output.value;
    expect(dialogOutput.length).toEqual(1);
    expect(dialogOutput[0].draftContent === draftContent).toBeTruthy();
    expect(dialogOutput[0].draftConfig === draftConfig).toBeTruthy();
  }, 10000);

  it("should confirm to use repo and reload files", async () => {

    ctx.component.data = data;
    ctx.detectChanges();
    await ctx.asyncWait();

    ctx.component.resolveConflict({ value: "repo" }, data.conflictFiles[0]);
    ctx.component.confirmAction();

    ctx.detectChanges();
    await ctx.asyncWait();
    const dialogOutput = ctx.dialogStub.output.value;
    expect(dialogOutput.length).toEqual(1);
    expect(dialogOutput[0].draftContent === originalContent).toBeTruthy();
    expect(dialogOutput[0].draftConfig === originalConfig).toBeTruthy();
  }, 10000);
});
