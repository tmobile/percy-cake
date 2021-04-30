/**
========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { StoreTestComponent, SETUP, TestContext, TEST_USER } from "test/test-helper";

import { FileManagementService } from "services/file-management.service";
import * as reducer from "../reducers/auth.reducers";
import * as AuthActions from "../actions/auth.actions";


describe("Auth store action/effect/reducer", () => {
  let ctx: TestContext<StoreTestComponent>;

  const setup = SETUP(StoreTestComponent);

  let fileService: FileManagementService;
  beforeEach(() => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
  });

  it("Login action should be successful", async () => {
    spyOn(fileService, "accessRepo").and.returnValue(Promise.resolve(TEST_USER));

    ctx.store.dispatch(new AuthActions.Login(TEST_USER));
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(true);

    await ctx.asyncWait();
    expect(reducer.getCurrentUser(ctx.authState())).toEqual(TEST_USER);
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(false);
    expect(reducer.getError(ctx.authState())).toEqual(null);
    expect(ctx.routerStub.value).toEqual(["/dashboard"]);

    await ctx.asyncWait();

    expect(JSON.parse(window.localStorage.getItem("auth"))).toEqual({ currentUser: TEST_USER });
  });

  it("Login action fail, login error should be saved to state", async () => {
    spyOn(fileService, "accessRepo").and.throwError("Mock error");

    ctx.store.dispatch(new AuthActions.Login(TEST_USER));
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(true);
    await ctx.asyncWait();
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(false);
    expect(reducer.getError(ctx.authState()).message).toEqual("Mock error");
  });

  it("LoginRedirect action should be successful", async () => {

    ctx.store.dispatch(new AuthActions.LoginRedirect({ redirectUrl: "/redirect-to" }));
    await ctx.asyncWait();

    expect(reducer.getRedirectUrl(ctx.authState())).toEqual("/redirect-to");
    expect(ctx.routerStub.value).toEqual(["/login"]);
  });

  it("Logout action should be successful", async () => {

    ctx.store.dispatch(new AuthActions.Logout());
    await ctx.asyncWait();

    expect(reducer.getCurrentUser(ctx.authState())).toEqual(null);
    expect(ctx.routerStub.value).toEqual(["/login"]);

    expect(JSON.parse(window.localStorage.getItem("auth"))).toEqual({ currentUser: null });
  });
});
