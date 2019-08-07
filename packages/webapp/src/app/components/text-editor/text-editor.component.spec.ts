import { Setup, TestContext } from "test/test-helper";

import { FileTypes } from "models/config-file";
import { TextEditorComponent } from "./text-editor.component";

describe("TextEditorComponent", () => {
  const setup = Setup(TextEditorComponent, false);
  let ctx: TestContext<TextEditorComponent>;

  const file1 = {
    applicationName: "",
    fileName: "test.md",
    fileType: FileTypes.MD,
    draftContent: "test",
    oid: "111111",
  };

  beforeEach(() => {
    ctx = setup();
  });

  it("should create TextEditorComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should init TextEditorComponent with edit file mode", () => {
    ctx.component.editMode = true;
    ctx.component.file = file1;
    ctx.component.isPercyrcFile = false;

    ctx.component.ngOnChanges({
      editMode: <any>{}
    });

    expect(ctx.component.editMode).toBeTruthy();

    expect(ctx.component.filename.disabled).toBeTruthy();
  });
});
