import { SETUP } from "test/test-helper";

import { LayoutComponent } from "./layout.component";

describe("LayoutComponent", () => {

  const ctx = SETUP(LayoutComponent);

  it("should create LayoutComponent", () => {
    expect(ctx().component).toBeTruthy();
  });
});
