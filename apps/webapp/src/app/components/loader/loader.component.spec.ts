import { SETUP } from "test/test-helper";

import { LoaderComponent } from "./loader.component";

describe("LoaderComponent", () => {

  const ctx = SETUP(LoaderComponent);

  it("should create LoaderComponent", () => {
    expect(ctx().component).toBeTruthy();
  });
});
