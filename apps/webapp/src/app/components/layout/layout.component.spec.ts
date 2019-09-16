import { Setup } from "test/test-helper";

import { LayoutComponent } from "./layout.component";

describe("LayoutComponent", () => {

  const ctx = Setup(LayoutComponent);

  it("should create LayoutComponent", () => {
    expect(ctx().component).toBeTruthy();
  });
});
