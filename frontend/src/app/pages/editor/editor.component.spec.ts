import { Setup } from 'test/test-helper';

import { EditorComponent } from './editor.component';

describe('EditorComponent', () => {

  const ctx = Setup(EditorComponent, null, true);

  it('should create EditorComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
