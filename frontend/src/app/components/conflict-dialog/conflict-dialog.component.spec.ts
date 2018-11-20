import { Setup } from 'test/test-helper';

import { ConflictDialogComponent } from './conflict-dialog.component';

describe('ConflictDialogComponent', () => {

  const ctx = Setup(ConflictDialogComponent, false);

  it('should create ConflictDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
