import { Setup } from 'test/test-helper';

import { ConfirmationDialogComponent } from './confirmation-dialog.component';

describe('ConfirmationDialogComponent', () => {

  const ctx = Setup(ConfirmationDialogComponent);

  it('should create ConfirmationDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('should confirm action', () => {
    ctx().component.confirmAction();
    expect(ctx().dialogStub.output.value).toBeTruthy();
  });
});
