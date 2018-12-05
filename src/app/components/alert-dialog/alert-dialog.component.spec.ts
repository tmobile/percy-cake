import { Setup, TestContext } from 'test/test-helper';

import { AlertDialogComponent } from './alert-dialog.component';

describe('AlertDialogComponent', () => {

  const setup = Setup(AlertDialogComponent, false);

  let ctx: TestContext<AlertDialogComponent>;
  beforeEach(() => {
    ctx = setup();
  });

  it('should create AlertDialogComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should trigger logout', async () => {
    // Init component
    const data = {
      message: 'Logout message',
      alertType: 'logout',
    };
    ctx.component.data = data;

    ctx.component.afterClosed();

    expect(ctx.routerStub.value).toEqual(['/login']);
  });

  it('should not trigger logout', async () => {
    // Init component
    const data = {
      message: 'Test message',
      alertType: 'info',
    };
    ctx.component.data = data;

    ctx.component.afterClosed();

    expect(ctx.routerStub.value).toBeUndefined();
  });
});
