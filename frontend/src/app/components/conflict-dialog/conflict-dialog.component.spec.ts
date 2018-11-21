import * as _ from 'lodash';

import { Setup, TestUser } from 'test/test-helper';

import { ConflictDialogComponent } from './conflict-dialog.component';
import { LoginSuccess } from 'store/actions/auth.actions';
import { API_BASE_URL } from 'services/http-helper.service';

describe('ConflictDialogComponent', () => {

  const ctx = Setup(ConflictDialogComponent, false, [new LoginSuccess(TestUser)]);
  const url = `repos/${TestUser.repoName}/branches/${TestUser.branchName}`;

  const data = {
    conflictFiles: [
      {
        fileName: 'sample.yaml',
        applicationname: 'app1',
        config: {
          'default': {
            'urls': {
                'api': {
                  '$type': 'object',
                  'host': {
                    '$type': 'string',
                    '$comment': ['api host'],
                    '$value': 'https://pd01.qat.t-mobile.com'
                  },
                  'version': {
                    '$type': 'number',
                    '$comment': ['api version', 'which is number'],
                    '$value': 2
                  }
                },
                'methods': {
                  '$type': 'array',
                  '$value': [
                    {
                      '$type': 'string',
                      '$value': 'GET'
                    },
                    {
                      '$type': 'string',
                      '$value': 'POST'
                    }
                  ],
                  '$comment': ['supported methods']
                },
                '$comment': ['define urls'],
                '$type': 'object'
            },
            '$type': 'object'
          },
          '$comment': [
            '##all known properties are defined in the default block.',
            'The most common values are assigned in the default block',
            '##That\'s default block'
          ]
        }
      }
    ],
    draftFiles: [
      {
        fileName: 'sample.yaml',
        applicationname: 'app1',
        draftConfig: {
          'default': {
            'urls': {
                'api': {
                  '$type': 'object',
                  'host': {
                    '$type': 'string',
                    '$value': 'https://pd02.qat.t-mobile.com'
                  }
                },
                '$type': 'object'
            },
            '$type': 'object'
          }
        }
      }
    ]
  };

  it('should create ConflictDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('should show conflicted files to resolve conflicts', () => {

    ctx().component.data = data;
    ctx().detectChanges();

    data.conflictFiles.forEach((file: any) => {
      expect(file.repoCode).toBeDefined();
      expect(file.draftCode).toBeDefined();
      expect(file.draftConfig).toBeDefined();
    });

    expect(ctx().component.fileIdx).toEqual(0);
    expect(ctx().component.allResolved()).toBeFalsy();

    ctx().component.resolveConflict({value: 'draft'}, data.conflictFiles[0]);
    expect(ctx().component.allResolved()).toBeTruthy();

    ctx().component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);
    expect(ctx().component.allResolved()).toBeTruthy();
  });

  it('should confirm to use draft and recommit', () => {

    ctx().component.data = data;
    ctx().detectChanges();

    ctx().component.resolveConflict({value: 'draft'}, data.conflictFiles[0]);

    ctx().component.confirmAction();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/commit`);
    ctx().httpMock.expectNone(`${API_BASE_URL}/${url}/files`);
  });

  it('should confirm to use repo and reload files', () => {

    ctx().component.data = data;
    ctx().detectChanges();

    ctx().component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);

    ctx().component.confirmAction();

    ctx().httpMock.expectNone(`${API_BASE_URL}/${url}/commit`);
    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/files`);
  });

  it('should confirm to use repo, still recommit because there is one more unconflicted draft', () => {

    ctx().component.data = _.cloneDeep(data);
    ctx().component.data.fromEditor = true;
    ctx().component.data.draftFiles.push(
    {
      fileName: 'sample2.yaml',
      applicationname: 'app2',
      draftConfig: {
        'default': {
          'urls': {
              'api': {
                '$type': 'object',
                'host': {
                  '$type': 'string',
                  '$value': 'https://pd02.qat.t-mobile.com'
                }
              },
              '$type': 'object'
          },
          '$type': 'object'
        }
      }
    });
    ctx().detectChanges();

    ctx().component.resolveConflict({value: 'repo'}, data.conflictFiles[0]);

    ctx().component.confirmAction();

    ctx().httpMock.expectOne(`${API_BASE_URL}/${url}/commit`);
    ctx().httpMock.expectNone(`${API_BASE_URL}/${url}/files`);
  });
});
