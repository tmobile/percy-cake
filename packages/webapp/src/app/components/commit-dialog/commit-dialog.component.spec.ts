import { Setup, TestContext } from "test/test-helper";

import { CommitDialogComponent } from "./commit-dialog.component";

describe("CommitDialogComponent", () => {

  const setup = Setup(CommitDialogComponent);

  let ctx: TestContext<CommitDialogComponent>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should create CommitDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should commit with message", () => {
    ctx.component.comment.setValue("commit message");
    ctx.component.commit();
    expect(ctx.dialogStub.output.value).toEqual("commit message");
  });

  it("should not commit without message", () => {
    ctx.component.comment.setValue("");
    ctx.component.commit();
    expect(ctx.dialogStub.output.value).toBeUndefined();
  });
});
