import { Setup, TestContext } from "test/test-helper";

import { ConfirmationDialogComponent } from "./confirmation-dialog.component";

describe("ConfirmationDialogComponent", () => {

  const setup = Setup(ConfirmationDialogComponent, false);

  let ctx: TestContext<ConfirmationDialogComponent>;
  beforeEach(() => {
    ctx = setup();
  });


  it("should create ConfirmationDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should confirm action", () => {
    ctx.component.confirmAction();
    expect(ctx.dialogStub.output.value).toBeTruthy();
  });
});
