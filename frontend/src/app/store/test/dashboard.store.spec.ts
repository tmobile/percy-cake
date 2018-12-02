import { StoreTestComponent, Setup, TestContext } from 'test/test-helper';

import { FileManagementService } from 'services/file-management.service';
import { ConfigFile, Configuration } from 'models/config-file';
import * as reducer from '../reducers/dashboard.reducer';
import { SelectApp, CollapseApps, ToggleApp, TableSort } from '../actions/dashboard.actions';
import * as BackendActions from "../actions/backend.actions";

const file1: ConfigFile = {
  fileName: 'test1.yaml',
  applicationName: 'app1',
  modified: true,
  oid: '111111',
  draftConfig: new Configuration(),
  originalConfig: new Configuration(),
};

describe('Dashboard store action/effect/reducer', () => {
  let ctx: TestContext<StoreTestComponent>;

  const setup = Setup(StoreTestComponent);

  beforeEach(() => {
    ctx = setup();
    const fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, 'getFiles').and.returnValue({files: [file1], applications: ['app1']});
    spyOn(fileService, 'commitFiles').and.returnValue([file1]);
    spyOn(fileService, 'saveDraft').and.returnValue(file1);
    spyOn(fileService, 'deleteFile').and.returnValue(false);
  });

  it('SelectApp action should be successful', async () => {
    ctx.store.dispatch(new SelectApp('app1'));
    expect(reducer.getSelectedApp(ctx.dashboarState())).toEqual('app1');
  });

  it('CollapseApps action should be successful', async () => {
    ctx.store.dispatch(new CollapseApps(['app1', 'app2']));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual(['app1', 'app2']);
  });

  it('ToggleApp action should be successful', async () => {
    ctx.store.dispatch(new CollapseApps(['app1', 'app2']));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual(['app1', 'app2']);

    ctx.store.dispatch(new ToggleApp('app1'));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual(['app2']);

    ctx.store.dispatch(new ToggleApp('app1'));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual(['app2', 'app1']);

    ctx.store.dispatch(new ToggleApp('app2'));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual(['app1']);

    ctx.store.dispatch(new ToggleApp('app1'));
    expect(reducer.getCollapsedApps(ctx.dashboarState())).toEqual([]);
  });

  it('TableSort action should be successful', async () => {
    ctx.store.dispatch(new TableSort({applicationName: 'desc'}));
    expect(reducer.getTableSort(ctx.dashboarState())).toEqual({
      applicationName: 'desc',
      fileName: 'asc',
    });

    ctx.store.dispatch(new TableSort({fileName: 'desc'}));
    expect(reducer.getTableSort(ctx.dashboarState())).toEqual({
      applicationName: 'desc',
      fileName: 'desc',
    });

    ctx.store.dispatch(new TableSort({applicationName: 'asc'}));
    expect(reducer.getTableSort(ctx.dashboarState())).toEqual({
      applicationName: 'asc',
      fileName: 'desc',
    });

    ctx.store.dispatch(new TableSort({fileName: 'asc'}));
    expect(reducer.getTableSort(ctx.dashboarState())).toEqual({
      applicationName: 'asc',
      fileName: 'asc',
    });
  });

  it('CommitChangesSuccess action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({files: [], fromEditor: false, message: ''}));
    expect(reducer.isCommittingFile(ctx.dashboarState())).toEqual(true);
    ctx.store.dispatch(new BackendActions.CommitChangesSuccess({files: [], fromEditor: false}));
    expect(reducer.isCommittingFile(ctx.dashboarState())).toEqual(false);
  });

  it('CommitChangesFailure action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.CommitChanges({files: [], fromEditor: false, message: ''}));
    expect(reducer.isCommittingFile(ctx.dashboarState())).toEqual(true);
    ctx.store.dispatch(new BackendActions.CommitChangesFailure({error: new Error('mock error'), files: [], fromEditor: false, commitMessage: ''}));
    expect(reducer.isCommittingFile(ctx.dashboarState())).toEqual(false);
  });

  it('DeleteFileSuccess action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.DeleteFile(file1));
    expect(reducer.isDeletingFile(ctx.dashboarState())).toEqual(true);
    ctx.store.dispatch(new BackendActions.DeleteFileSuccess(file1));
    expect(reducer.isDeletingFile(ctx.dashboarState())).toEqual(false);
  });

  it('DeleteFileFailure action should be successful', async () => {
    ctx.store.dispatch(new BackendActions.DeleteFile(file1));
    expect(reducer.isDeletingFile(ctx.dashboarState())).toEqual(true);
    ctx.store.dispatch(new BackendActions.DeleteFileFailure(new Error('mock error')));
    expect(reducer.isDeletingFile(ctx.dashboarState())).toEqual(false);
  });

});
