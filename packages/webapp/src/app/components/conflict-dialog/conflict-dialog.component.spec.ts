import { Setup, TestContext, utilService } from "test/test-helper";

import { ConflictDialogComponent } from "./conflict-dialog.component";
import { Configuration, ConflictFile } from "models/config-file";

describe("ConflictDialogComponent", () => {
  const setup = Setup(ConflictDialogComponent, false);

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
  beforeEach(() => {
    ctx = setup();
  });

  const data = {
    conflictFiles: [conflictFile],
  };

  it("should create ConflictDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should show conflicted files to resolve conflicts", () => {

    ctx.component.data = data;
    ctx.detectChanges();

    expect(ctx.component.fileIdx).toEqual(0);
    expect(ctx.component.allResolved()).toBeFalsy();

    ctx.component.resolveConflict({ value: "draft" }, data.conflictFiles[0]);
    expect(ctx.component.allResolved()).toBeTruthy();

    ctx.component.resolveConflict({ value: "repo" }, data.conflictFiles[0]);
    expect(ctx.component.allResolved()).toBeTruthy();
  });

  it("should confirm to use draft and recommit", () => {

    ctx.component.data = data;
    ctx.detectChanges();

    ctx.component.resolveConflict({ value: "draft" }, data.conflictFiles[0]);
    ctx.component.confirmAction();

    const dialogOutput = ctx.dialogStub.output.value;
    expect(dialogOutput.length).toEqual(1);
    expect(dialogOutput[0].draftContent === draftContent).toBeTruthy();
    expect(dialogOutput[0].draftConfig === draftConfig).toBeTruthy();
  });

  it("should confirm to use repo and reload files", () => {

    ctx.component.data = data;
    ctx.detectChanges();

    ctx.component.resolveConflict({ value: "repo" }, data.conflictFiles[0]);
    ctx.component.confirmAction();

    const dialogOutput = ctx.dialogStub.output.value;
    expect(dialogOutput.length).toEqual(1);
    expect(dialogOutput[0].draftContent === originalContent).toBeTruthy();
    expect(dialogOutput[0].draftConfig === originalConfig).toBeTruthy();
  });
});
