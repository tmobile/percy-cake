import { Setup, TestContext } from "test/test-helper";

import { AlertDialogComponent } from "./alert-dialog.component";
import { AlertClosed } from "store/actions/common.actions";

describe("AlertDialogComponent", () => {

  const setup = Setup(AlertDialogComponent, false);

  let ctx: TestContext<AlertDialogComponent>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should create AlertDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should trigger logout", async () => {
    // Init component
    const data = {
      message: "Logout message",
      alertType: "logout",
    };
    ctx.component.data = data;

    ctx.store.next(new AlertClosed(data));

    expect(ctx.routerStub.value).toEqual(["/login"]);
  });

  it("should go to dashboard", async () => {
    // Init component
    const data = {
      message: "Logout message",
      alertType: "go-to-dashboard",
    };
    ctx.component.data = data;

    ctx.store.next(new AlertClosed(data));

    expect(ctx.routerStub.value).toEqual(["/dashboard"]);
  });

  it("should not trigger logout", async () => {
    // Init component
    const data = {
      message: "Test message",
      alertType: "info",
    };
    ctx.component.data = data;

    ctx.store.next(new AlertClosed(data));

    expect(ctx.routerStub.value).toBeUndefined();
  });
});
