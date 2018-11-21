import { convertToParamMap } from '@angular/router';

import { Setup, TestUser, assertDialogOpened } from 'test/test-helper';

import { API_BASE_URL } from 'services/http-helper.service';
import { LoginSuccess } from 'store/actions/auth.actions';

import { EditorComponent } from './editor.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { UtilService } from 'services/util.service';
import { ConfigurationChange } from 'store/actions/editor.actions';

describe('EditorComponent', () => {

  const ctx = Setup(EditorComponent, false, [new LoginSuccess(TestUser)]);

  const url = `repos/${TestUser.repoName}/branches/${TestUser.branchName}`;

  const files = [
    {
      applicationName: 'app1',
      fileName: 'sample.yaml',
      timestamp: Date.now(),
      size: 100,
    },
    {
      applicationName: 'app1',
      fileName: TestUser.envFileName,
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
      fileName: TestUser.envFileName,
      timestamp: Date.now(),
      size: 100,
    },
  ];
  const apps = ['app1', 'app2', 'app3'];

  it('should create EditorComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('should init EditorComponent with edit file mode', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: true,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
        fileName: 'sample.yaml'
      })
    };
    ctx().detectChanges();

    expect(ctx().component.filename.disabled).toBeTruthy();
  });

  it('should init EditorComponent with new file mode', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: false,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx().detectChanges();

    expect(ctx().component.filename.disabled).toBeFalsy();
  });

  it('should prevent to leave page', () => {
    const event: any = {};

    ctx().component.isPageDirty = false;
    ctx().component.onLeavePage(event);
    expect(event.returnValue).toBeFalsy();
    expect(ctx().component.canDeactivate()).toBeTruthy();

    ctx().component.isPageDirty = true;
    ctx().component.onLeavePage(event);
    expect(event.returnValue).toBeTruthy();

    ctx().component.canDeactivate();
    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'There may be unsaved changes. Are you sure you want to navigate?'
      }
    });
  });

  it('should change file name', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: false,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx().detectChanges();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`).flush(files);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications`).flush(apps);

    ctx().component.filename.setValue('new.yaml');
    ctx().component.fileNameChange();
    expect(ctx().component.filename.valid).toBeTruthy();
  });

  it('should not change to existing file name', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: false,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx().detectChanges();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`).flush(files);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications`).flush(apps);

    ctx().component.filename.setValue('sample.yaml');
    ctx().component.fileNameChange();
    expect(ctx().component.filename.valid).toBeFalsy();
  });

  it('should save draft when editing file', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: true,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
        fileName: 'sample.yaml'
      })
    };
    ctx().detectChanges();

    const config = {
      default: { $type: 'object' },
      environments: { $type: 'object' }
    };
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`).flush(files);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications`).flush(apps);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications/app1/environments`).flush(['dev', 'qat']);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications/app1/files/sample.yaml`).flush(config);

    ctx().component.saveConfig();

    expect(ctx().routerStub.value).toEqual(['/dashboard']);
  });

  it('should save draft when adding new file', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: false,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx().detectChanges();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`).flush(files);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications`).flush(apps);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications/app1/environments`).flush(['dev', 'qat']);

    ctx().component.filename.setValue('new');
    ctx().component.saveConfig();

    expect(ctx().routerStub.value).toEqual(['/dashboard']);
  });

  it('should commit new file', () => {
    ctx().activatedRouteStub.snapshot = {
      data: {
        inEditMode: false,
        inEnvMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx().detectChanges();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`).flush(files);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications`).flush(apps);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/applications/app1/environments`).flush(['dev', 'qat']);

    ctx().component.filename.setValue('new');
    ctx().component.commitFile();

    assertDialogOpened(CommitDialogComponent, undefined);
    ctx().dialogStub.output.next('commit message');


    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/commit`).flush({
      fileName: 'new.yaml',
      applicationName: 'app1',
      timestamp: Date.now(),
      size: 100
    });
    expect(ctx().routerStub.value).toEqual(['/dashboard']);
  });

  it('should view compiled yaml code', () => {
    const config = {
      'default': {
        'api': {
          '$comment': ['urls used by this application'],
          '$type': 'object',
          'host': {
            '$comment': ['qat data server'],
            '$type': 'string',
            '$value': 'https://pd01.qat.t-mobile.com:9000'
          },
          'urls': {
            '$type': 'object',
            'getCatalog': {
              '$type': 'string',
              '$value': '{{api.host}}/api/catalog?device=phone&pageSize={{size}}&pageNum={{page}}'
            },
            'getDetails': {
              '$type': 'string',
              '$value': '{{api.host}}/api/product/details/{{deviceId}}'
            },
            '$comment': [
              'all known properties are defined in the default block.',
              'The most common values are assigned in the default block'
            ],
          },
          'staging-items': {
            '$value': [
                {
                    '$comment': ['item1 comment'],
                    '$value': 'item1',
                    '$type': 'string'
                },
                {
                    '$comment': ['item2 comment'],
                    '$value': 'item2',
                    '$type': 'string'
                },
            ],
            '$type': 'array'
          },
        },
        '$type': 'object'
      },
      'environments': {
        'dev': {
          'inherits' : {
            '$type': 'string',
            '$value': 'qat'
          },
          'staging-items': {
            '$value': [
                {
                    '$comment': ['item1 comment'],
                    '$value': 'new item1',
                    '$type': 'string'
                },
            ],
            '$type': 'array'
          },
          '$type': 'object'
        },
        'qat': {
            'api': {
              '$type': 'object',
              'urls': {
                '$type': 'object',
                'getCatalog': {
                  '$type': 'string',
                  '$value': '{{api.host}}/api/catalog?device=phone&pageSize={{size}}&pageNum={{page}}'
                },
                '$comment': [
                  'all known properties are defined in the default block.',
                  'The most common values are assigned in the default block'
                ],
              },
              'staging-items': {
                '$value': [
                    {
                        '$comment': ['item1 comment'],
                        '$value': 'item1',
                        '$type': 'string'
                    },
                ],
                '$type': 'array'
              },
            },
            '$type': 'object'
        },
        '$type': 'object'
      }
    };
    ctx().store.dispatch(new ConfigurationChange(config));

    ctx().component.showCompiledYAML('dev');
  });
});
