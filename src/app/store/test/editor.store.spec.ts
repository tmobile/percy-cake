import { ConfigFile, Configuration } from 'models/config-file';
import * as BackendActions from '../actions/backend.actions';
import { FileManagementService } from 'services/file-management.service';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';

import { StoreTestComponent, Setup, TestContext, assertDialogOpened } from 'test/test-helper';
import { TreeNode } from 'models/tree-node';
import { PageLoad, ConfigurationChange } from '../actions/editor.actions';
import * as reducer from '../reducers/editor.reducer';

const file1: ConfigFile = {
  fileName: 'test1.yaml',
  applicationName: 'app1',
  modified: true,
  oid: '111111',
  draftConfig: new Configuration(),
  originalConfig: new Configuration(),
};

const file2: ConfigFile = {
  fileName: 'test1.yaml',
  applicationName: 'app1',
  modified: false,
  oid: '222222',
  originalConfig: new Configuration(),
};

describe('Editor store action/effect/reducer', () => {
  let ctx: TestContext<StoreTestComponent>;
  let fileService: FileManagementService;

  const setup = Setup(StoreTestComponent);

  beforeEach(() => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, 'getFiles').and.returnValue({ files: [file1], applications: ['app1'] });
    spyOn(fileService, 'commitFiles').and.returnValue([file1]);
    spyOn(fileService, 'saveDraft').and.returnValue(file1);
    spyOn(fileService, 'deleteFile').and.returnValue(false);
  });

  it('PageLoad action should be successful', async () => {
    spyOn(fileService, 'getEnvironments').and.returnValue({ environments: ['dev', 'prod'], appPercyConfig: { key: 'value' } });

    ctx.store.dispatch(new PageLoad({ applicationName: 'app1', editMode: true }));
    await ctx.fixture.whenStable();

    expect(ctx.editorState().editMode).toBeTruthy();
    expect(reducer.getEnvironments(ctx.editorState())).toEqual(['dev', 'prod']);
    expect(reducer.getAppPercyConfig(ctx.editorState())).toEqual({ key: 'value' });
  });

  it('PageLoad action fail, alert dialog should show', async () => {

    spyOn(fileService, 'getEnvironments').and.throwError('Mock error');

    ctx.store.dispatch(new PageLoad({ applicationName: 'app1', editMode: true }));
    await ctx.fixture.whenStable();
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: 'Mock error',
        alertType: 'error'
      }
    });
  });

  it('GetFileContentSuccess action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.draftConfig);
    expect(reducer.getConfiguration(ctx.editorState()) !== file1.draftConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file2 }));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file2);
    expect(reducer.getConfigFile(ctx.editorState()) !== file2).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file2.originalConfig);
    expect(reducer.getConfiguration(ctx.editorState()) !== file2.originalConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);
  });

  it('ConfigurationChange action should be successful', async () => {
    spyOn(fileService, 'getEnvironments').and.returnValue(['dev', 'prod']);
    const newConfig = new Configuration();
    newConfig.default.addChild(new TreeNode('key'));

    ctx.store.dispatch(new PageLoad({ applicationName: 'app1', editMode: false }));
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file1 }));
    ctx.store.dispatch(new ConfigurationChange(newConfig));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual({ ...file1, modified: true });
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(newConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new PageLoad({ applicationName: 'app1', editMode: true }));
    ctx.store.dispatch(new BackendActions.GetFileContentSuccess({ file: file2 }));
    ctx.store.dispatch(new ConfigurationChange(newConfig));
    await ctx.fixture.whenStable();

    expect(reducer.getConfigFile(ctx.editorState())).toEqual({ ...file2, modified: true });
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(newConfig);
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(true);
  });

  it('SaveDraft action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.SaveDraft({ file: file1, redirect: false }));
    expect(reducer.isSaving(ctx.editorState())).toEqual(true);
  });

  it('SaveDraftSuccess action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.SaveDraftSuccess(file1));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfigFile(ctx.editorState()).draftConfig !== file1.draftConfig).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.draftConfig);
    expect(reducer.getConfiguration(ctx.editorState()) === file1.draftConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it('SaveDraftFailure action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.SaveDraftFailure(new Error('Mock error')));
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it('CommitChanges action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: false, message: '' }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(false);
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: true, message: '' }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);
  });

  it('CommitChangesSuccess action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({ files: [], fromEditor: false }));
    expect(reducer.getConfigFile(ctx.editorState())).toEqual(null);

    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({ files: [file1], fromEditor: true }));

    expect(reducer.getConfigFile(ctx.editorState())).toEqual(file1);
    expect(reducer.getConfigFile(ctx.editorState()) !== file1).toBeTruthy();
    expect(reducer.getConfigFile(ctx.editorState()).originalConfig !== file1.originalConfig).toBeTruthy();
    expect(reducer.getConfiguration(ctx.editorState())).toEqual(file1.originalConfig);
    expect(reducer.getConfiguration(ctx.editorState()) === file1.originalConfig).toBeTruthy();
    expect(reducer.getIsPageDirty(ctx.editorState())).toEqual(false);
    expect(reducer.isSaving(ctx.editorState())).toEqual(false);
  });

  it('CommitChangesFailure action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({ files: [], fromEditor: true, message: '' }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.CommitChangesFailure(
      { error: new Error('mock error'), files: [], fromEditor: false, commitMessage: '' }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(true);

    ctx.store.dispatch(new BackendActions.CommitChangesFailure(
      { error: new Error('mock error'), files: [], fromEditor: true, commitMessage: '' }));
    expect(reducer.isCommitting(ctx.editorState())).toEqual(false);
  });
});
