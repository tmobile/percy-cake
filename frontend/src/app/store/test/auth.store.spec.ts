import { StoreTestComponent, Setup, TestContext, TestUser } from 'test/test-helper';

import { FileManagementService } from 'services/file-management.service';
import * as reducer from '../reducers/auth.reducers';
import * as AuthActions from "../actions/auth.actions";


describe('Auth store action/effect/reducer', () => {
  let ctx: TestContext<StoreTestComponent>;

  const setup = Setup(StoreTestComponent);

  let fileService: FileManagementService;
  beforeEach(() => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
  });

  it('Login action should be successful', async () => {
    spyOn(fileService, 'accessRepo').and.returnValue(TestUser);

    ctx.store.dispatch(new AuthActions.Login(TestUser));
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(true);

    await ctx.fixture.whenStable();

    expect(reducer.getCurrentUser(ctx.authState())).toEqual(TestUser);
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(false);
    expect(reducer.getError(ctx.authState())).toEqual(null);
    expect(ctx.routerStub.value).toEqual(['/dashboard']);
  });

  it('Login action fail, login error should be saved to state', async () => {
    spyOn(fileService, 'accessRepo').and.throwError('Mock error');

    ctx.store.dispatch(new AuthActions.Login(TestUser));
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(true);
    await ctx.fixture.whenStable();
    expect(reducer.getFormProcessing(ctx.authState())).toEqual(false);
    expect(reducer.getError(ctx.authState()).message).toEqual('Mock error');
  });

  it('LoginRedirect action should be successful', async () => {

    ctx.store.dispatch(new AuthActions.LoginRedirect({redirectUrl: '/redirect-to'}));

    expect(reducer.getRedirectUrl(ctx.authState())).toEqual('/redirect-to');
    expect(ctx.routerStub.value).toEqual(['/login']);
  });

  it('Logout action should be successful', async () => {

    ctx.store.dispatch(new AuthActions.Logout());

    expect(reducer.getCurrentUser(ctx.authState())).toEqual(null);
    expect(ctx.routerStub.value).toEqual(['/login']);
  });
});
