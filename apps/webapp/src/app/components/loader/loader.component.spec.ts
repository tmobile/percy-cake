import { Setup } from "test/test-helper";

import { LoaderComponent } from "./loader.component";

describe("LoaderComponent", () => {

  const ctx = Setup(LoaderComponent);

  it("should create LoaderComponent", () => {
    expect(ctx().component).toBeTruthy();
  });
});
