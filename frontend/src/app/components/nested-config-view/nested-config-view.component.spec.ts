import { Setup } from 'test/test-helper';

import { NestedConfigViewComponent } from './nested-config-view.component';

describe('NestedConfigViewComponent', () => {

  const ctx = Setup(NestedConfigViewComponent);

  it('should create NestedConfigViewComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
