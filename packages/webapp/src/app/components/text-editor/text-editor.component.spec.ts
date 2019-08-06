import { Setup, TestContext } from "test/test-helper";

import { TextEditorComponent } from "./text-editor.component";

describe("TextEditorComponent", () => {
  const setup = Setup(TextEditorComponent, false);
  let ctx: TestContext<TextEditorComponent>;

  beforeEach(() => {
    ctx = setup();
  });

  it("should create TextEditorComponent", () => {
    expect(ctx.component).toBeTruthy();
  });
});
