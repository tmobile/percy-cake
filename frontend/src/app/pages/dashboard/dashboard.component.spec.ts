import { Sort } from '@angular/material';
import * as _ from 'lodash';

import { LoginSuccess } from 'store/actions/auth.actions';
import { TestUser, Setup, assertDialogOpened } from 'test/test-helper';

import { DashboardComponent } from './dashboard.component';
import { SaveDraft } from 'store/actions/backend.actions';
import { ConfigFile, Configuration } from 'models/config-file';
import { SelectAppDialogComponent } from 'components/select-app-dialog/select-app-dialog.component';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';
import { ConflictDialogComponent } from 'components/conflict-dialog/conflict-dialog.component';
import { percyConfig } from 'config';

describe('DashboardComponent', () => {

  const url = `repos/${TestUser.repoName}/branches/${TestUser.branchName}`;

  const ctx = Setup(DashboardComponent, true, [new LoginSuccess(TestUser)]);

  const files = [
    {
      applicationName: 'app1',
      fileName: 'sample.yaml',
      timestamp: Date.now(),
      size: 100,
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
  const apps = ['app1', 'app2', 'app3'];

  beforeEach(() => {
    // ctx().httpMock.expectOne(`/${url}/files`).flush(files);
    // ctx().httpMock.expectOne(`/${url}/applications`).flush(apps);
  });

  it('should create DashboardComponent', () => {
    expect(ctx().component).toBeTruthy();
    expect(ctx().component.envFileName).toEqual(percyConfig.environmentsFile);
    ctx().component.ngOnDestroy();
    expect(ctx().component.foldersSubscription.closed).toBeTruthy();
  });

  it('should show apps and files properly', () => {
    expect(ctx().observables.folders.value).toEqual([
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
  });

  it('should expand/collapse application', () => {
    ctx().component.toggleApp('app1');
    expect(ctx().observables.folders.value).toEqual([
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

    ctx().component.toggleApp('app1');
    expect(ctx().observables.folders.value).toEqual([
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
  });

  it('should expand/collapse all applications', () => {
    ctx().component.toggleAllApps(new Event('click'));
    expect(ctx().observables.folders.value).toEqual([
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

    ctx().component.toggleAllApps(new Event('click'));
    expect(ctx().observables.folders.value).toEqual([
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
  });

  it('should only show selected application', () => {
    ctx().component.onSelectApp({value: 'app1'});
    expect(ctx().observables.folders.value).toEqual([
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

    ctx().component.onSelectApp({value: 'app2'});
    expect(ctx().observables.folders.value).toEqual([
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

    ctx().component.onSelectApp({value: 'app3'});
    expect(ctx().observables.folders.value).toEqual([
      {
        app: 'app3',
      }
    ]);
  });

  it('should sort by application/file name properly', () => {
    let sort: Sort = {
      active: 'applicationName',
      direction: 'desc'
    };
    ctx().component.onSortChange(sort);

    expect(ctx().observables.folders.value).toEqual([
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
    ctx().component.onSortChange(sort);

    expect(ctx().observables.folders.value).toEqual([
      {
        app: 'app3',
      },
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: files[2],
      },
      {
        app: 'app2',
        appFile: files[3],
      },
      {
        app: 'app1',
      },
      {
        app: 'app1',
        appFile: files[0],
      },
      {
        app: 'app1',
        appFile: files[1],
      },
    ]);
  });

  it('should navigate to add new file', () => {
    ctx().component.addNewFile();
    assertDialogOpened(SelectAppDialogComponent, {
      data: {
        envFileName: percyConfig.environmentsFile,
        applications: apps,
        selectedApp: '',
        files
      },
      autoFocus: false
    });

    ctx().dialogStub.output.next({createEnv: true, appName: 'app3'});
    expect(ctx().routerStub.value).toEqual(['/files/newenv', 'app3', percyConfig.environmentsFile]);

    ctx().dialogStub.output.next({createEnv: false, appName: 'app2'});
    expect(ctx().routerStub.value).toEqual(['/files/new', 'app2']);
  });

  it('should navigate to edit file', () => {

    const file = files[0];
    ctx().component.editFile(file);
    expect(ctx().routerStub.value).toEqual(['/files/edit', file.applicationName, file.fileName]);

    file.fileName = percyConfig.environmentsFile;
    ctx().component.editFile(file);
    expect(ctx().routerStub.value).toEqual(['/files/editenv', file.applicationName, file.fileName]);
  });

  it('should delete file successfully', () => {

    const file = files[0];

    const path = `/${url}/applications/${file.applicationName}/files/${file.fileName}`;
    ctx().component.deleteFile(file);
    ctx().dialogStub.output.next(false);
    ctx().httpMock.expectNone(path);

    ctx().component.deleteFile(file);
    ctx().dialogStub.output.next(true);
    expect(ctx().observables.isDeleting.value).toBeTruthy();
    ctx().httpMock.expectOne(path).flush({});
    expect(ctx().observables.isDeleting.value).toBeFalsy();

    // File should be removed
    expect(ctx().observables.folders.value.filter(f => f.appFile && f.appFile.fileName === file.fileName &&
      f.appFile.applicationName === file.applicationName).length).toEqual(0);

    // Alert should be shown
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: `${file.applicationName} / ${file.fileName} deleted successfully.`,
        alertType: 'delete'
      }
    });

    // Should reload from repo
    const newRepoFile = {
      applicationName: 'app2',
      fileName: percyConfig.environmentsFile,
      timestamp: Date.now(),
      size: 100,
    };
    ctx().httpMock.expectOne(`/${url}/files`).flush([newRepoFile]);
    ctx().httpMock.expectOne(`/${url}/applications`).flush(['app2']);

    expect(ctx().observables.folders.value).toEqual([
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: newRepoFile,
      },
    ]);
  });

  it('should delete uncommitted new draft file successfully', () => {
    // At fist save a new draft file
    const newDraftFile: ConfigFile = {
      fileName: 'new.yaml',
      applicationName: apps[0],
      draftConfig:  new Configuration(),
      modified: true,
    };

    ctx().store.dispatch(new SaveDraft({ file: newDraftFile, redirect: false }));
    expect(ctx().observables.folders.value.filter(f => f.appFile && f.appFile.fileName === newDraftFile.fileName &&
      f.appFile.applicationName === newDraftFile.applicationName).length).toEqual(1);

    // Delete file
    ctx().component.deleteFile(newDraftFile);
    ctx().dialogStub.output.next(true);

    // File should be removed
    expect(ctx().observables.folders.value.filter(f => f.appFile && f.appFile.fileName === newDraftFile.fileName &&
      f.appFile.applicationName === newDraftFile.applicationName).length).toEqual(0);

    // Alert should be shown
    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: `${newDraftFile.applicationName} / ${newDraftFile.fileName} deleted successfully.`,
        alertType: 'delete'
      }
    });

    // Shouldn't reload
    ctx().httpMock.expectNone(`/${url}/files`);
    ctx().httpMock.expectNone(`/${url}/applications`);
  });

  it('should show alert if failed to delete file', () => {

    const file = files[0];

    const path = `/${url}/applications/${file.applicationName}/files/${file.fileName}`;
    ctx().component.deleteFile(file);
    ctx().dialogStub.output.next(true);

    expect(ctx().observables.isDeleting.value).toBeTruthy();
    ctx().httpMock.expectOne(path).flush(
      {
        message: 'Failed to delete file',
        statusCode: 500
      },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );
    expect(ctx().observables.isDeleting.value).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: 'Failed to delete file',
        alertType: 'error'
      }
    });
  });

  it('should commit changes successfully', () => {
    const file = ctx().observables.folders.value[1].appFile;
    const modifiedFile: ConfigFile = {
      ...file,
      originalConfig: {
        default: {$type: 'object', key: {$value: 'value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      draftConfig: {
        default: {$type: 'object', key: {$value: 'new value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      modified: true,
      timestamp: Date.now() - 1000,
      size: 90,
    };

    ctx().observables.folders.value[1].appFile = modifiedFile;

    ctx().component.commitChanges();

    ctx().dialogStub.output.next('commit message');

    expect(ctx().observables.isCommitting.value).toBeTruthy();
    const path = `/${url}/commit`;
    const committedFile: ConfigFile = {
      fileName: modifiedFile.fileName,
      applicationName: modifiedFile.applicationName,
      size: 100
    };
    ctx().httpMock.expectOne(path).flush([committedFile]);
    expect(ctx().observables.isCommitting.value).toBeFalsy();

    const result: ConfigFile = {
      ...modifiedFile,
      ...committedFile,
      modified: false,
      originalConfig: modifiedFile.draftConfig
    };
    expect(ctx().observables.folders.value[1].appFile).toEqual(result);

    // Should reload from repo
    const newRepoFile = {
      applicationName: 'app2',
      fileName: percyConfig.environmentsFile,
      timestamp: Date.now(),
      size: 100,
    };
    ctx().httpMock.expectOne(`/${url}/files`).flush([newRepoFile]);
    ctx().httpMock.expectOne(`/${url}/applications`).flush(['app2']);

    expect(ctx().observables.folders.value).toEqual([
      {
        app: 'app2',
      },
      {
        app: 'app2',
        appFile: newRepoFile,
      },
    ]);
  });

  it('should show alert if failed to commit changes', () => {

    const file = ctx().observables.folders.value[1].appFile;
    const modifiedFile: ConfigFile = {
      ...file,
      originalConfig: {
        default: {$type: 'object', key: {$value: 'value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      draftConfig: {
        default: {$type: 'object', key: {$value: 'new value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      modified: true,
      timestamp: Date.now() - 1000,
      size: 90,
    };

    ctx().observables.folders.value[1].appFile = modifiedFile;

    ctx().component.commitChanges();

    ctx().dialogStub.output.next('commit message');

    expect(ctx().observables.isCommitting.value).toBeTruthy();
    const path = `/${url}/commit`;
    ctx().httpMock.expectOne(path).flush(
      {
        message: 'Failed to commit file',
        statusCode: 500
      },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );
    expect(ctx().observables.isCommitting.value).toBeFalsy();

    assertDialogOpened(AlertDialogComponent, {
      data: {
        message: 'Failed to commit file',
        alertType: 'error'
      }
    });
  });

  it('should show resolve conflict dialog if commit conflict', () => {

    const file = ctx().observables.folders.value[1].appFile;
    const modifiedFile: ConfigFile = {
      ...file,
      originalConfig: {
        default: {$type: 'object', key: {$value: 'value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      draftConfig: {
        default: {$type: 'object', key: {$value: 'new value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      modified: true,
      timestamp: Date.now() - 1000,
      size: 90,
    };

    ctx().observables.folders.value[1].appFile = modifiedFile;

    ctx().component.commitChanges();

    ctx().dialogStub.output.next('commit message');

    expect(ctx().observables.isCommitting.value).toBeTruthy();
    const path = `/${url}/commit`;
    const conflictFiles = [{
      ..._.pick(modifiedFile, ['fileName', 'applicationName']),
      config: {
        default: {$type: 'object', key: {$value: 'conflict value', $type: 'string'}},
        environments: {$type: 'object'}
      },
      timestamp: Date.now(),
      size: 100,
    }];
    ctx().httpMock.expectOne(path).flush(
      {
        message: 'Conflict to commit file',
        statusCode: 409,
        conflictFiles
      },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );
    expect(ctx().observables.isCommitting.value).toBeFalsy();

    assertDialogOpened(ConflictDialogComponent, {
      data: {
        fromEditor: undefined,
        draftFiles : [modifiedFile],
        conflictFiles,
        commitMessage: 'commit message'
      }
    });
  });

});
