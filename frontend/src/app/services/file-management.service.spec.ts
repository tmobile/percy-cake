import * as path from 'path';
import * as _ from 'lodash';

import { TestUser } from 'test/test-helper';

import { UtilService } from './util.service';
import { MaintenanceService } from './maintenance.service';
import { FileManagementService } from './file-management.service';
import { git, FSExtra, getBrowserFS } from './git-fs.service';
import { percyConfig } from 'config';

describe('FileManagementService', () => {

  const utilService = new UtilService();
  let maintenanceService: MaintenanceService;

  const {repoFolder} = utilService.getRepoFolder(TestUser);

  const dir = path.resolve(percyConfig.reposFolder, repoFolder);
  const repoMetadataFile = utilService.getMetadataPath(repoFolder);

  let fs: FSExtra;
  let fileService;

  let cloneStub: jasmine.Spy;
  let pullStub: jasmine.Spy;
  let resolveRefStub: jasmine.Spy;
  let statusMatrixStub: jasmine.Spy;
  let resetIndexStub: jasmine.Spy;

  beforeEach(async() => {
    fs = await getBrowserFS();
    await fs.emptyDir(percyConfig.reposFolder);
    await fs.emptyDir(percyConfig.draftFolder);
    await fs.emptyDir(percyConfig.metaFolder);

    maintenanceService = new MaintenanceService();
    fileService = new FileManagementService(utilService, maintenanceService);

    cloneStub = spyOn(git, 'clone');
    cloneStub.and.callFake(async (ops) => {
      await git.init({ dir: ops.dir});
      console.info(ops)
    });

    pullStub = spyOn(git, 'fetch');

    resolveRefStub = spyOn(git, 'resolveRef');
    resolveRefStub.and.returnValue('12345');

    statusMatrixStub = spyOn(git, 'statusMatrix');
    statusMatrixStub.and.returnValue([]);

    resetIndexStub = spyOn(git, 'resetIndex');
  });

  const assertHeadRef = async(sha) => {
    expect((await fs.readFile(path.resolve(dir, '.git', 'refs', 'heads', TestUser.branchName))).toString()).toEqual(sha);
  }

  it('should clone repo successfully', async () => {
    statusMatrixStub.and.returnValue([['a.txt', 1, 0, 0], ['b.txt', 1, 0, 1]]);

    const user = await fileService.accessRepo(TestUser);

    expect(cloneStub.calls.count()).toEqual(1);

    expect(resolveRefStub.calls.count()).toEqual(1);

    // Head SHA ref should be same as remotes SHA
    assertHeadRef(resolveRefStub.calls.first().returnValue);

    // Status matrix should be queried
    expect(statusMatrixStub.calls.count()).toEqual(1);
    expect(statusMatrixStub.calls.first().args[0]).toEqual({ dir, pattern: '**' });

    // Index should be reset
    expect(resetIndexStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.first().args[0]).toEqual({ fs: git.plugins.get('fs'), dir, filepath: 'a.txt' });

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, repoFolder, percyConfig.yamlAppsFolder);
    expect(await fs.exists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(await maintenanceService.getUserTypeAhead(TestUser.username[0])).toEqual([TestUser.username]);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect(_.isEqual(_.omit(user, 'password'), _.omit(metadata, 'password', 'commitBaseSHA', 'version'))).toBeTruthy();
  });

  it('repo exists but metadata missing, should clone repo again', async () => {
    cloneStub.and.throwError('Mock clone error');

    await fs.mkdirs(dir);
    await fs.remove(repoMetadataFile);

    try {
      await fileService.accessRepo(TestUser);
      fail('should clone again');
    } catch(err) {
      expect(err.message.indexOf('Mock clone error') > -1).toBeTruthy();
    }
  });

  it('repo exists but metadata broken, should clone repo again', async () => {

    cloneStub.and.throwError('Mock clone error');

    await fs.mkdirs(dir);
    await fs.writeFile(repoMetadataFile, 'Not a JSON file');

    try {
      await fileService.accessRepo(TestUser);
      fail('should clone again');
    } catch(err) {
      expect(err.message.indexOf('Mock clone error') > -1).toBeTruthy();
    }
  });

  it('repo exists but metadata version changes, should clone repo again', async () => {

    cloneStub.and.throwError('Mock clone error');

    await fs.mkdirs(dir);
    const metadata = {
      ...TestUser,
      version: percyConfig.repoMetadataVersion + '1'
    }
    await fs.outputJson(repoMetadataFile, metadata);

    try {
      await fileService.accessRepo(TestUser);
      fail('should clone again');
    } catch(err) {
      expect(err.message.indexOf('Mock clone error') > -1).toBeTruthy();
    }
  });

  it('should pull repo successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fs.writeFile(dir + '/test.txt', 'aaaa');

    pullStub.and.returnValue({ fetchHead: '67890' });
    statusMatrixStub.and.returnValue([['a.txt', 1, 0, 1], ['b.txt', 1, 0, 0]]);

    const user = await fileService.accessRepo(TestUser);

    expect(cloneStub.calls.count()).toEqual(1);
    expect(pullStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(2);

    // Repo files should be cleaned
    expect(await fs.exists(dir + '/test.txt')).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadRef(pullStub.calls.first().returnValue.fetchHead);

    // Status matrix should be queried
    expect(statusMatrixStub.calls.count()).toEqual(2);
    expect(statusMatrixStub.calls.argsFor(1)[0]).toEqual({ dir, pattern: '**' });

    // Index should be reset
    expect(resetIndexStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.first().args[0]).toEqual({ fs: git.plugins.get('fs'), dir, filepath: 'b.txt' });

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, repoFolder, percyConfig.yamlAppsFolder);
    expect(await fs.exists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(await maintenanceService.getUserTypeAhead(TestUser.username[0])).toEqual([TestUser.username]);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect(_.isEqual(_.omit(user, 'password'), _.omit(metadata, 'password', 'commitBaseSHA', 'version'))).toBeTruthy();
  });

  it('pull should need reset Index if commit actaully changes', async () => {
    await fileService.accessRepo(TestUser);

    pullStub.and.returnValue({ fetchHead: '12345' });
    await fileService.accessRepo(TestUser);

    expect(statusMatrixStub.calls.count()).toEqual(1);
  });

  it('pull timeout, should fallback to clone', async () => {

    await fileService.accessRepo(TestUser);

    percyConfig.pullTimeout = '1s';
    pullStub.and.callFake(async() => {
      await new Promise(resolve => setTimeout(resolve, 1100)); // wait for timeout
    });

    await fileService.accessRepo(TestUser);
    expect(cloneStub.calls.count()).toEqual(2);
  })
});
