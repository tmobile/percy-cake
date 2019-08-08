import { Setup, TestContext } from "test/test-helper";
import * as _ from "lodash";

import { FileTypes } from "models/config-file";
import { TextEditorComponent } from "./text-editor.component";

import { PageLoadSuccess } from "store/actions/editor.actions";
import { LoadFilesSuccess, GetFileContentSuccess } from "store/actions/backend.actions";

describe("TextEditorComponent", () => {
  const setup = Setup(TextEditorComponent, false);
  let ctx: TestContext<TextEditorComponent>;

  const fileEdit = {
    applicationName: "",
    fileName: "test.md",
    fileType: FileTypes.MD,
    draftContent: "test",
    oid: "111111",
  };

  const fileNew1 = {
    applicationName: "",
    fileName: null,
    fileType: FileTypes.MD,
    draftContent: "",
    oid: "222222",
  };

  const fileNew2 = {
    applicationName: "",
    fileName: null,
    fileType: FileTypes.PERCYRC,
    draftContent: "",
    oid: "333333",
  };

  beforeEach(() => {
    ctx = setup();
  });

  it("should create TextEditorComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should init TextEditorComponent with edit file mode", () => {
    ctx.component.editMode = true;
    ctx.component.file = fileEdit;
    ctx.component.isPercyrcFile = false;
    ctx.detectChanges();

    ctx.component.ngOnChanges({
      editMode: <any>{}
    });

    expect(ctx.component.editMode).toBeTruthy();
    expect(ctx.component.filename.disabled).toBeTruthy();
    expect(ctx.component.showFileEditor).toBeFalsy();
    expect(ctx.component.fileContent).toEqual("test");
  });

  async function initNewFileMode(file) {
    ctx.component.editMode = false;
    ctx.component.file = file;
    ctx.component.isPercyrcFile = file.fileType === FileTypes.PERCYRC;
    ctx.detectChanges();

    ctx.store.next(new LoadFilesSuccess({ files: [fileEdit], applications: ["app1", "app2"], appConfigs: {} }));
    ctx.store.next(new PageLoadSuccess({ environments: ["dev"] }));
    ctx.store.next(new GetFileContentSuccess({file, newlyCreated: true}));

    await ctx.fixture.whenStable();
  }

  it("should init TextEditorComponent with new file mode", async () => {
    await initNewFileMode(fileNew1);

    const focusSpy = spyOn(ctx.component.fileNameInput, "focus");

    await new Promise((resolve) => {
      setImmediate(async () => {
        await expect(focusSpy.calls.count()).toEqual(1);
        resolve();
      });
    });

    expect(ctx.component.showFileEditor).toBeTruthy();

    ctx.component.filename.setValue("");
    expect(ctx.component.filename.valid).toBeFalsy();

    ctx.component.filename.setValue("test1.md");
    expect(ctx.component.filename.valid).toBeTruthy();
  });

  it("should not change to existing file name", async () => {
    await initNewFileMode(fileNew1);

    ctx.component.filename.setValue(fileEdit.fileName.replace("\.md", ""));
    expect(ctx.component.filename.valid).toBeFalsy();
    expect(ctx.component.filename.hasError("alreadyExists")).toBeTruthy();
  });

  it("should validate properly", async () => {
    await initNewFileMode(fileNew2);

    // for percyrc files its always valid
    let result = ctx.component.validate();
    expect(result.valid).toBeTruthy();

    await initNewFileMode(fileNew1);
    const focusSpy = spyOn(ctx.component.fileNameInput, "focus");

    ctx.component.filename.setValue("");
    expect(ctx.component.filename.valid).toBeFalsy();

    result = ctx.component.validate();
    expect(result.valid).toBeFalsy();

    expect(focusSpy.calls.any()).toBeTruthy();

    ctx.component.filename.setValue("test11.md");
    expect(ctx.component.filename.valid).toBeTruthy();

    result = ctx.component.validate();
    expect(result.valid).toBeTruthy();
  });
});
