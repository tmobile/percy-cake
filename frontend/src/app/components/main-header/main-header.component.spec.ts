import { Setup } from 'test/test-helper';

import { MainHeaderComponent } from './main-header.component';

describe('MainHeaderComponent', () => {

  const ctx = Setup(MainHeaderComponent);

  it('should create MainHeaderComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
