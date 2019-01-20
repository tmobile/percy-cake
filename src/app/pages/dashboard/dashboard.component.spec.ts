import { Sort } from '@angular/material';

import { Setup, assertDialogOpened, TestContext, TestUser } from 'test/test-helper';

import { DashboardComponent } from './dashboard.component';
import { LoadFilesSuccess, Refresh } from 'store/actions/backend.actions';
import { SelectAppDialogComponent } from 'components/select-app-dialog/select-app-dialog.component';
import { percyConfig } from 'config';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { Alert } from 'store/actions/common.actions';
import { ToggleApp, CollapseApps, TableSort, SelectApp } from 'store/actions/dashboard.actions';
import { LoginSuccess } from 'store/actions/auth.actions';

describe('DashboardComponent', () => {
  const setup = Setup(DashboardComponent);

  const files = [
    {
      applicationName: 'app1',
      fileName: 'sample.yaml',
      timestamp: Date.now(),
      size: 100,
      modified: true
    },
    {
      applicationName: 'app1',
      fileName: percyConfig.environmentsFile,
      timestamp: Date.now(),
      size: 100,
    },
    {
      applicationName: 'app2',
      fileName: 'sample.yaml',
      timestamp: Date.now(),
      size: 100,
    },
    {
      applicationName: 'app2',
      fileName: percyConfig.environmentsFile,
      timestamp: Date.now(),
      size: 100,
    },
  ];
  const applications = ['app1', 'app2', 'app3'];

  let ctx: TestContext<DashboardComponent>;
  let dispatchSpy: jasmine.Spy;
  beforeEach(() => {
    ctx = setup();
    const backup = ctx.store.dispatch;
    dispatchSpy = spyOn(ctx.store, 'dispatch');
    dispatchSpy.and.callFake((action) => {
      if (action instanceof Alert || action instanceof ToggleApp || action instanceof SelectApp
        || action instanceof CollapseApps || action instanceof TableSort) {
        return backup.apply(ctx.store, [action]);
      }
    });

    ctx.store.next(new LoadFilesSuccess({ files, applications }));
  });

  it('should create DashboardComponent', () => {
    expect(ctx.component).toBeTruthy();
    expect(ctx.component.isEnvFile(files[0])).toBeFalsy();
    expect(ctx.component.isEnvFile(files[1])).toBeTruthy();

    ctx.store.next(new LoginSuccess({...TestUser, repositoryUrl: 'https://bitbucket.org/repo'}));
    expect(ctx.component.pullRequestUrl).toEqual(`https://bitbucket.org/repo/pull-requests/new?source=${TestUser.branchName}&t=1#diff`);

    ctx.store.next(new LoginSuccess({...TestUser, repositoryUrl: 'https://github.com/repo'}));
    expect(ctx.component.pullRequestUrl).toEqual(`https://github.com/repo/pull/new/${TestUser.branchName}`);

    ctx.store.next(new LoginSuccess({...TestUser, repositoryUrl: 'https://gitlab.com/repo'}));
    expect(ctx.component.pullRequestUrl).toEqual(`https://gitlab.com/repo/merge_requests/new`);

    ctx.store.next(new LoginSuccess({...TestUser, repositoryUrl: 'https://not-supported.com/repo'}));
    expect(ctx.component.pullRequestUrl).toBeNull();

    ctx.component.ngOnDestroy();
    expect(ctx.component.foldersSubscription.closed).toBeTruthy();
  });

  it('should show apps and files properly', () => {
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app3',
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();
  });

  it('should expand/collapse application', async () => {
    ctx.component.toggleApp('app1');
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app3',
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();

    ctx.component.toggleApp('app1');
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app3',
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();
  });

  it('should expand/collapse all applications', () => {
    ctx.component.toggleAllApps(new Event('click'));
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app2',
      },
      {
        app: 'app3',
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();

    ctx.component.toggleAllApps(new Event('click'));
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app3',
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();
  });

  it('should only show selected application', () => {
    ctx.component.onSelectApp({ value: 'app1' });
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeFalsy();

    ctx.component.onSelectApp({ value: 'app2' });
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
    ]);
    expect(ctx.component.disableCommit.value).toBeTruthy();

    ctx.component.onSelectApp({ value: 'app3' });
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app3',
      }
    ]);
    expect(ctx.component.disableCommit.value).toBeTruthy();
  });

  it('should sort by application/file name properly', () => {
    let sort: Sort = {
      active: 'applicationName',
      direction: 'desc'
    };
    ctx.component.onSortChange(sort);

    expect(ctx.component.disableCommit.value).toBeFalsy();
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app3',
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
    ]);

    sort = {
      active: 'fileName',
      direction: 'desc'
    };
    ctx.component.onSortChange(sort);

    expect(ctx.component.disableCommit.value).toBeFalsy();
    expect(ctx.component.folders.value).toEqual([
      {
        app: 'app3',
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[1],
      },
      {
        app: 'app1',
        appFile: files[0],
      },
    ]);
  });

  it('should navigate to add new file', () => {
    ctx.component.addNewFile();
    assertDialogOpened(SelectAppDialogComponent, {
      data: {
        envFileName: percyConfig.environmentsFile,
        applications,
        selectedApp: '',
        files
      },
      autoFocus: false
    });

    ctx.dialogStub.output.next({ createEnv: true, appName: 'app3' });
    expect(ctx.routerStub.value).toEqual(['/files/newenv', 'app3', percyConfig.environmentsFile]);

    ctx.dialogStub.output.next({ createEnv: false, appName: 'app2' });
    expect(ctx.routerStub.value).toEqual(['/files/new', 'app2']);
  });

  it('should navigate to edit file', () => {

    let file = files[0];
    ctx.component.editFile(file);
    expect(ctx.routerStub.value).toEqual(['/files/edit', file.applicationName, file.fileName]);

    file = files[1];
    ctx.component.editFile(file);
    expect(ctx.routerStub.value).toEqual(['/files/editenv', file.applicationName, file.fileName]);
  });

  // it('should checkout branch successfully', () => {

  //   const principal: Principal = {
  //     user: { ...TestUser },
  //     repoMetadata: { ...TestUser, version: '1.0', commitBaseSHA: {} }
  //   };
  //   ctx.store.next(new Initialized({ principal }));

  //   ctx.component.checkoutBranch();
  //   assertDialogOpened(BranchesDialogComponent, { data: { principal } });
  //   const data = { type: 'create', branch: 'some-branch' };
  //   ctx.dialogStub.output.next(data);

  //   expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual(data);
  // });

  it('should sync master successfully', () => {

    ctx.store.next(new LoginSuccess(TestUser));

    ctx.component.syncMaster();

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual({
      srcBranch: 'master',
      targetBranch: TestUser.branchName,
    });
  });

  it('should commit files successfully', () => {
    ctx.component.commitChanges();
    assertDialogOpened(CommitDialogComponent);
    ctx.dialogStub.output.next('commit message');

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual({
      files: [files[0]],
      message: 'commit message',
    });
  });

  it('should delete file successfully', () => {
    const file = files[0];

    ctx.component.deleteFile(file);
    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Delete ${file.applicationName}/${file.fileName} ?`
      }
    });
    ctx.dialogStub.output.next(false);
    expect(dispatchSpy.calls.count()).toEqual(0);

    ctx.component.deleteFile(file);
    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Delete ${file.applicationName}/${file.fileName} ?`
      }
    });
    ctx.dialogStub.output.next(true);
    expect(dispatchSpy.calls.count()).toEqual(1);
    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual(file);
  });

  it('should refresh files successfully', () => {
    ctx.component.refresh();

    expect(dispatchSpy.calls.mostRecent().args[0] instanceof Refresh).toBeTruthy();
  });

});
