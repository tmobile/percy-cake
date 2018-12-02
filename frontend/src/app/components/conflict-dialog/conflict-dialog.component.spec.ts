import { Setup, TestContext } from 'test/test-helper';

import { ConflictDialogComponent } from './conflict-dialog.component';
import { Configuration } from 'models/config-file';

describe('ConflictDialogComponent', () => {
  const setup = Setup(ConflictDialogComponent, false);

  const draftFile = 
  {
    fileName: 'sample.yaml',
    applicationname: 'app1',
    draftConfig: new Configuration()
  };

  const conflictFile = 
  {
    fileName: 'sample.yaml',
    applicationname: 'app1',
    originalConfig: new Configuration()
  }

  let ctx: TestContext<ConflictDialogComponent>;
  let dispatchSpy: jasmine.Spy;
  beforeEach(() => {
    ctx = setup();
    dispatchSpy = spyOn(ctx.store, 'dispatch');
  });

  const data = {
    conflictFiles: [conflictFile],
    draftFiles: [draftFile],
    fromEditor: true,
    commitMessage: 'test commit',
  };

  it('should create ConflictDialogComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should show conflicted files to resolve conflicts', () => {

    ctx.component.data = data;
    ctx.detectChanges();

    data.conflictFiles.forEach((file: any) => {
      expect(file.repoCode).toBeDefined();
      expect(file.draftCode).toBeDefined();
      expect(file.draftConfig).toBeDefined();
    });

    expect(ctx.component.fileIdx).toEqual(0);
    expect(ctx.component.allResolved()).toBeFalsy();

    ctx.component.resolveConflict({value: 'draft'}, data.conflictFiles[0]);
    expect(ctx.component.allResolved()).toBeTruthy();

    ctx.component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);
    expect(ctx.component.allResolved()).toBeTruthy();
  });

  it('should confirm to use draft and recommit', () => {

    ctx.component.data = data;
    ctx.detectChanges();

    ctx.component.resolveConflict({value: 'draft'}, data.conflictFiles[0]);
    ctx.component.confirmAction();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload.resolveConflicts).toBeTruthy();
    expect(payload.fromEditor).toEqual(data.fromEditor);
    expect(payload.message).toEqual(data.commitMessage);
    expect(payload.files[0].draftConfig === draftFile.draftConfig).toBeTruthy();
  });

  it('should confirm to use repo and reload files', () => {

    ctx.component.data = data;
    ctx.detectChanges();

    ctx.component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);
    ctx.component.confirmAction();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload.resolveConflicts).toBeTruthy();
    expect(payload.fromEditor).toEqual(data.fromEditor);
    expect(payload.message).toEqual(data.commitMessage);
    expect(payload.files[0].draftConfig === conflictFile.originalConfig).toBeTruthy();
  });

  it('should confirm to use repo, still recommit because there is one more unconflicted draft', () => {

    ctx.component.data = data;

    const anotherFile = {
      fileName: 'sample2.yaml',
      applicationname: 'app1',
      draftConfig: new Configuration()
    }
    ctx.component.data.draftFiles.push(anotherFile);
    ctx.detectChanges();

    ctx.component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);
    ctx.component.confirmAction();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload.resolveConflicts).toBeTruthy();
    expect(payload.fromEditor).toEqual(data.fromEditor);
    expect(payload.message).toEqual(data.commitMessage);
    expect(payload.files[0].draftConfig === conflictFile.originalConfig).toBeTruthy();
    expect(payload.files[1] === anotherFile).toBeTruthy();
  });
});
