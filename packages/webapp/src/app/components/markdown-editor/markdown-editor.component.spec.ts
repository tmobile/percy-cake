import { Setup, TestContext } from "test/test-helper";

import { MarkdownEditorComponent } from "./markdown-editor.component";

describe("MarkdownEditorComponent", () => {
  const setup = Setup(MarkdownEditorComponent, false);
  let ctx: TestContext<MarkdownEditorComponent>;

  beforeEach(() => {
    ctx = setup();
  });

  it("should create MarkdownEditorComponent", () => {
    expect(ctx.component).toBeTruthy();
  });
});
