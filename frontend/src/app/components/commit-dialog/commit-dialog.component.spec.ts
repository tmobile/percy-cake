import { Setup } from 'test/test-helper';

import { CommitDialogComponent } from './commit-dialog.component';

describe('CommitDialogComponent', () => {

  const ctx = Setup(CommitDialogComponent);

  it('should create CommitDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
