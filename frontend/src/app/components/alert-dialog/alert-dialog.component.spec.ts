import { Setup } from 'test/test-helper';

import { AlertDialogComponent } from './alert-dialog.component';

describe('AlertDialogComponent', () => {

  const ctx = Setup(AlertDialogComponent);

  it('should create AlertDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
