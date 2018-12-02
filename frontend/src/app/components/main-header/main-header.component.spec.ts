import { Setup, TestContext } from 'test/test-helper';
import * as AuthActions from 'store/actions/auth.actions';

import { MainHeaderComponent } from './main-header.component';

describe('MainHeaderComponent', () => {

  const setup = Setup(MainHeaderComponent, false);

  let ctx: TestContext<MainHeaderComponent>;
  let dispatchSpy: jasmine.Spy;
  beforeEach(() => {
    ctx = setup();
    dispatchSpy = spyOn(ctx.store, 'dispatch');
  });

  it('should create MainHeaderComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should logout successfully', () => {
    ctx.component.logout();
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof AuthActions.Logout).toBeTruthy();
  });
});
