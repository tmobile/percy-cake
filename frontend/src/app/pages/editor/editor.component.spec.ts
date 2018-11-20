import { Setup } from 'test/test-helper';

import { EditorComponent } from './editor.component';

describe('EditorComponent', () => {

  const ctx = Setup(EditorComponent, false);

  it('should create EditorComponent', () => {
    expect(ctx().component).toBeTruthy();
  });
});
