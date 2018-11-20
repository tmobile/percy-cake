import { Setup } from 'test/test-helper';

import { SelectAppDialogComponent } from './select-app-dialog.component';

describe('SelectAppDialogComponent', () => {

  const ctx = Setup(SelectAppDialogComponent, null, true);

  it('should create SelectAppDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
