import * as path from 'path';
import * as _ from 'lodash';

import { TestUser, utilService } from 'test/test-helper';

import { percyConfig } from 'config';
import { Configuration } from 'models/config-file';
import { TreeNode } from 'models/tree-node';
import { MaintenanceService } from './maintenance.service';
import { FileManagementService, PathFinder } from './file-management.service';
import { git, FSExtra } from './util.service';

describe('FileManagementService', () => {

  let maintenanceService: MaintenanceService;

  const { repoFolder } = utilService.getRepoFolder(TestUser);

  const dir = path.resolve(percyConfig.reposFolder, repoFolder);
  const repoMetadataFile = utilService.getMetadataPath(repoFolder);

  const commitOid1 = '12345';
  const commitOid2 = '67890';

  const objectTree = [
    {
      object: { tree: commitOid1 }
    },
    {
      object: {
        entries: [
          { path: 'README.md', type: 'blob' },
          { path: 'apps', type: 'tree' }
        ]
      }
    },
    {
      object: {
        entries: [
          { path: 'app1', type: 'tree' },
          { path: 'app2', type: 'tree' },
          { path: 'app3', type: 'tree' },
          { path: '.gitignore', type: 'blob' }
        ]
      }
    },
    {
      object: {
        entries: [
          { path: 'app1-client.yaml', type: 'blob', oid: '111111' },
          { path: 'app1-server.yaml', type: 'blob', oid: '222222' },
          { path: 'environments.yml', type: 'blob', oid: '333333' },
          { path: '.gitignore', type: 'blob' },
        ]
      }
    },
    {
      object: {
        entries: [
          { path: 'app2-client.yaml', type: 'blob', oid: '444444' },
          { path: 'app2-server.yaml', type: 'blob', oid: '555555' },
          { path: 'nest', type: 'tree' },
        ]
      }
    },
    {
      object: {
        entries: [
          { path: 'app3-empty.txt', type: 'blob' },
        ]
      }
    }
  ];

  let fs: FSExtra;
  let fileService: FileManagementService;

  let cloneStub: jasmine.Spy;
  let pullStub: jasmine.Spy;
  let resolveRefStub: jasmine.Spy;
  let statusMatrixStub: jasmine.Spy;
  let resetIndexStub: jasmine.Spy;
  let statusStub: jasmine.Spy;
  let readObjectStub: jasmine.Spy;
  let addStub: jasmine.Spy;
  let removeStub: jasmine.Spy;
  let commitStub: jasmine.Spy;
  let pushStub: jasmine.Spy;

  beforeEach(async () => {
    fs = await utilService.getBrowserFS();
    await fs.emptyDir(percyConfig.reposFolder);
    await fs.emptyDir(percyConfig.draftFolder);
    await fs.emptyDir(percyConfig.metaFolder);

    maintenanceService = new MaintenanceService(utilService);
    fileService = new FileManagementService(utilService, maintenanceService);

    cloneStub = spyOn(git, 'clone');
    cloneStub.and.callFake(async (ops) => {
      await git.init({ dir: ops.dir });
      await fs.mkdirs(path.resolve(ops.dir, '.git', 'refs', 'remotes', 'origin'));
      await fs.writeFile(path.resolve(ops.dir, '.git', 'refs', 'remotes', 'origin', TestUser.branchName), commitOid1);
    });

    resolveRefStub = spyOn(git, 'resolveRef');
    resolveRefStub.and.returnValue(commitOid1);

    pullStub = spyOn(git, 'fetch');
    pullStub.and.returnValue({ fetchHead: commitOid1 });

    statusMatrixStub = spyOn(git, 'statusMatrix');
    statusMatrixStub.and.returnValue([]);

    resetIndexStub = spyOn(git, 'resetIndex');
    statusStub = spyOn(git, 'status');
    readObjectStub = spyOn(git, 'readObject');
    addStub = spyOn(git, 'add');
    removeStub = spyOn(git, 'remove');
    commitStub = spyOn(git, 'commit');
    pushStub = spyOn(git, 'push');
  });

  const assertHeadRef = async (sha) => {
    expect((await fs.readFile(path.resolve(dir, '.git', 'refs', 'heads', TestUser.branchName))).toString()).toEqual(sha);
  };

  const assertRemoteRef = async (sha) => {
    expect((await fs.readFile(path.resolve(dir, '.git', 'refs', 'remotes', 'origin', TestUser.branchName))).toString()).toEqual(sha);
  };

  it('should clone repo successfully', async () => {
    statusMatrixStub.and.returnValue([['a.txt', 1, 0, 0], ['b.txt', 1, 0, 1]]);

    const user = await fileService.accessRepo(TestUser);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect({ ..._.omit(user, 'password'), commitBaseSHA: {}, version: percyConfig.repoMetadataVersion })
      .toEqual(_.omit(metadata, 'password'));

    expect(cloneStub.calls.count()).toEqual(1);

    expect(resolveRefStub.calls.count()).toEqual(1);

    // Head SHA ref should be same as remotes SHA
    assertHeadRef(commitOid1);
    assertRemoteRef(commitOid1);

    // Status matrix should be queried
    expect(statusMatrixStub.calls.count()).toEqual(1);
    expect(statusMatrixStub.calls.first().args[0]).toEqual({ dir, pattern: '**' });

    // Index should be reset
    expect(resetIndexStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.first().args[0]).toEqual({ fs: git.plugins.get('fs'), dir, filepath: 'a.txt' });

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, repoFolder, percyConfig.yamlAppsFolder);
    expect(await fs.pathExists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(await maintenanceService.getUserTypeAhead(TestUser.username[0])).toEqual([TestUser.username]);
  });

  it('repo exists but metadata missing, should clone repo again', async () => {
    cloneStub.and.throwError('Mock clone error');

    await fs.mkdirs(dir);
    await fs.remove(repoMetadataFile);

    try {
      await fileService.accessRepo(TestUser);
      fail('should clone again');
    } catch (err) {
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
    } catch (err) {
      expect(err.message.indexOf('Mock clone error') > -1).toBeTruthy();
    }
  });

  it('repo exists but metadata version changes, should clone repo again', async () => {

    cloneStub.and.throwError('Mock clone error');

    await fs.mkdirs(dir);
    const metadata = {
      ...TestUser,
      version: percyConfig.repoMetadataVersion + '1'
    };
    await fs.outputJson(repoMetadataFile, metadata);

    try {
      await fileService.accessRepo(TestUser);
      fail('should clone again');
    } catch (err) {
      expect(err.message.indexOf('Mock clone error') > -1).toBeTruthy();
    }
  });

  it('should pull repo successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fs.writeFile(dir + '/test.txt', 'aaaa');

    pullStub.and.callFake(async (ops) => {
      await fs.writeFile(path.resolve(ops.dir, '.git', 'refs', 'remotes', 'origin', TestUser.branchName), commitOid2);
      return { fetchHead: commitOid2 };
    });
    statusMatrixStub.and.returnValue([['a.txt', 1, 0, 1], ['b.txt', 1, 0, 0]]);

    const user = await fileService.accessRepo(TestUser);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect({ ..._.omit(user, 'password'), commitBaseSHA: {}, version: percyConfig.repoMetadataVersion })
      .toEqual(_.omit(metadata, 'password'));

    expect(cloneStub.calls.count()).toEqual(1);
    expect(pullStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(2);

    // Repo files should be cleaned
    expect(await fs.pathExists(dir + '/test.txt')).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Status matrix should be queried
    expect(statusMatrixStub.calls.count()).toEqual(2);
    expect(statusMatrixStub.calls.argsFor(1)[0]).toEqual({ dir, pattern: '**' });

    // Index should be reset
    expect(resetIndexStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.first().args[0]).toEqual({ fs: git.plugins.get('fs'), dir, filepath: 'b.txt' });

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, repoFolder, percyConfig.yamlAppsFolder);
    expect(await fs.pathExists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(await maintenanceService.getUserTypeAhead(TestUser.username[0])).toEqual([TestUser.username]);
  });

  it('should refresh repo successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fs.writeFile(dir + '/test.txt', 'aaaa');

    pullStub.and.callFake(async (ops) => {
      await fs.writeFile(path.resolve(ops.dir, '.git', 'refs', 'remotes', 'origin', TestUser.branchName), commitOid2);
      return { fetchHead: commitOid2 };
    });
    statusMatrixStub.and.returnValue([['a.txt', 1, 0, 1], ['b.txt', 1, 0, 0]]);

    const { pulledCommit, changed } = await fileService.refresh({ user: TestUser, repoMetadata: {} });
    expect(pulledCommit).toEqual(commitOid2);
    expect(changed).toBeTruthy();

    expect(pullStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(2);

    // Repo files should be cleaned
    expect(await fs.pathExists(dir + '/test.txt')).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Status matrix should be queried
    expect(statusMatrixStub.calls.count()).toEqual(2);
    expect(statusMatrixStub.calls.argsFor(1)[0]).toEqual({ dir, pattern: '**' });

    // Index should be reset
    expect(resetIndexStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.first().args[0]).toEqual({ fs: git.plugins.get('fs'), dir, filepath: 'b.txt' });
  });

  it('should refresh repo without new commits', async () => {
    await fileService.accessRepo(TestUser);
    const { pulledCommit, changed } = await fileService.refresh({ user: TestUser, repoMetadata: {} });
    expect(pulledCommit).toEqual(commitOid1);
    expect(changed).toBeFalsy();

    expect(pullStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(2);
    expect(statusMatrixStub.calls.count()).toEqual(1);
    expect(resetIndexStub.calls.count()).toEqual(0);
  });

  it('pull should only reset Index if commit actaully changes', async () => {
    await fileService.accessRepo(TestUser);

    await fileService.accessRepo(TestUser);

    assertHeadRef(commitOid1);
    assertRemoteRef(commitOid1);

    expect(statusMatrixStub.calls.count()).toEqual(1);
  });

  it('pull timeout, should fallback to clone', async () => {

    await fileService.accessRepo(TestUser);

    percyConfig.pullTimeout = '1s';
    pullStub.and.callFake(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100)); // wait for timeout
    });

    await fileService.accessRepo(TestUser);
    expect(cloneStub.calls.count()).toEqual(2);
  });

  it('should get app environments successfully', async () => {
    const principal = { user: TestUser, repoMetadata: {} };

    statusStub.and.returnValue('unmodified');

    const config = new Configuration();
    config.environments.addChild(new TreeNode('dev'));
    config.environments.addChild(new TreeNode('qat'));
    config.environments.addChild(new TreeNode('prod'));

    readObjectStub.and.returnValue({ object: utilService.convertTreeToYaml(config) });

    const envs = await fileService.getEnvironments(principal, 'app1');

    expect(statusStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(1);
    expect(readObjectStub.calls.count()).toEqual(1);

    expect(envs).toEqual(['dev', 'qat', 'prod']);
  });

  it('should get an empty array when environments file does not exists', async () => {
    const principal = { user: TestUser, repoMetadata: {} };

    statusStub.and.returnValue('absent');

    const envs = await fileService.getEnvironments(principal, 'app1');

    expect(statusStub.calls.count()).toEqual(1);
    expect(resolveRefStub.calls.count()).toEqual(0);
    expect(readObjectStub.calls.count()).toEqual(0);

    expect(envs).toEqual([]);
  });

  it('should get files successfully', async () => {
    readObjectStub.and.returnValues(...objectTree);

    const draftPath = path.resolve(percyConfig.draftFolder, repoFolder);
    const draftAppsPath = path.resolve(draftPath, percyConfig.yamlAppsFolder);
    await fs.mkdirs(draftAppsPath);
    await fs.mkdirs(draftAppsPath + '/app1');
    await fs.mkdirs(draftAppsPath + '/app2/nest');
    await fs.writeFile(draftAppsPath + '/test.txt', 'text');
    await fs.writeFile(draftAppsPath + '/app1/app1-client.yaml', '{}');
    await fs.writeFile(draftAppsPath + '/app2/test.txt', 'text');

    const principal = { user: TestUser, repoMetadata: {} };
    const result = await fileService.getFiles(principal);

    expect(resolveRefStub.calls.count()).toEqual(1);
    expect(readObjectStub.calls.count()).toEqual(6);

    expect(result.applications.sort()).toEqual(['app1', 'app2', 'app3']);
    expect(_.sortBy(result.files, ['applicationName', 'filename'])).toEqual([
      { applicationName: 'app1', fileName: 'app1-client.yaml', size: 2, modified: true, oid: '111111' },
      { applicationName: 'app1', fileName: 'app1-server.yaml', modified: false, oid: '222222' },
      { applicationName: 'app1', fileName: 'environments.yml', modified: false, oid: '333333' },
      { applicationName: 'app2', fileName: 'app2-client.yaml', modified: false, oid: '444444' },
      { applicationName: 'app2', fileName: 'app2-server.yaml', modified: false, oid: '555555' }
    ]);
  });

  it('should get file content successfully', async () => {

    statusStub.and.returnValue('unmodified');

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ oid: '222333', object: utilService.convertTreeToYaml(originalConfig) });

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    draftConfig.environments.addChild(new TreeNode('prod'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, oid: '222333', modified: true, originalConfig, draftConfig });
  });

  it('should get file content without draft config successfully', async () => {

    statusStub.and.returnValue('unmodified');

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ oid: '222333', object: utilService.convertTreeToYaml(originalConfig) });

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.remove(pathFinder.draftFullFilePath);

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, oid: '222333', modified: false, originalConfig });
  });

  it('should get file content without original config successfully', async () => {

    statusStub.and.returnValue('absent');

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    draftConfig.environments.addChild(new TreeNode('prod'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, modified: true, draftConfig });
  });

  it('get file content, original config and draft config are same', async () => {

    statusStub.and.returnValue('unmodified');

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ object: utilService.convertTreeToYaml(originalConfig) });

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder.repoFilePath]: '112233' } } };

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, modified: false, originalConfig, draftConfig: undefined });

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('error expected if both original config and draft config missing', async () => {

    statusStub.and.returnValue('absent');

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.remove(pathFinder.draftFullFilePath);

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    try {
      await fileService.getFileContent(principal, file);
      fail('error expected');
    } catch (err) {
      expect(/File (.*) does not exist/.test(err.message)).toBeTruthy();
    }
  });

  it('should save draft file successfully', async () => {
    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      draftConfig,
      modified: true,
      oid: '223344'
    };
    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    await fileService.saveDraft(principal, file);

    const pathFinder = new PathFinder(TestUser, file);

    const draftFile = await fs.readFile(pathFinder.draftFullFilePath);
    expect(utilService.parseYamlConfig(draftFile.toString())).toEqual(draftConfig);

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({ [pathFinder.repoFilePath]: file.oid });
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({ [pathFinder.repoFilePath]: file.oid });
  });

  it('save draft file which is same as original file, draft file should be deleted', async () => {
    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      draftConfig: originalConfig,
      originalConfig,
      modified: false,
      oid: '223344'
    };

    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.mkdirs(pathFinder.repoAppDir);
    await fs.writeFile(pathFinder.fullFilePath, utilService.convertTreeToYaml(originalConfig));
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(originalConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder.repoFilePath]: file.oid } } };

    await fileService.saveDraft(principal, file);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('should delete draft-only file successfully', async () => {

    statusStub.and.returnValue('absent');

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
    };
    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    const result = await fileService.deleteFile(principal, file);

    // Should not be pulled
    expect(result).toBeFalsy();
    expect(pullStub.calls.count()).toEqual(0);
    expect(removeStub.calls.count()).toEqual(0);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();
  });

  it('should delete both draft and original file successfully', async () => {

    await fileService.accessRepo(TestUser);

    statusStub.and.returnValue('unmodified');
    commitStub.and.returnValue(commitOid2);

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };
    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder.repoFilePath]: file.oid } } };

    const result = await fileService.deleteFile(principal, file);

    // Should pushed to repo
    expect(result).toBeFalsy();
    expect(pullStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('should delete original-only file successfully', async () => {

    await fileService.accessRepo(TestUser);

    statusStub.and.returnValue('unmodified');
    commitStub.and.returnValue(commitOid2);

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };
    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    const result = await fileService.deleteFile(principal, file);

    // Should pushed to repo
    expect(result).toBeFalsy();
    expect(pullStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('delete failed when push, should reset to last commit', async () => {

    await fileService.accessRepo(TestUser);

    statusStub.and.returnValue('unmodified');
    commitStub.and.returnValue(commitOid2);
    pushStub.and.throwError('mock push error');

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };
    const pathFinder = new PathFinder(TestUser, file);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder.repoFilePath]: file.oid } } };

    try {
      await fileService.deleteFile(principal, file);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('mock push error')).toBeGreaterThan(-1);
      expect(pullStub.calls.count()).toEqual(1);
      expect(removeStub.calls.count()).toEqual(1);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadRef(commitOid1);
      assertRemoteRef(commitOid1);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA).toEqual({ [pathFinder.repoFilePath]: file.oid });
    }
  });

  it('should commit changed files successfully', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.returnValues(...objectTree, ...objectTree);
    commitStub.and.returnValue(commitOid2);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: '111111',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
      oid: '222222'
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder1.repoFilePath]: file1.oid } } };

    const result = await fileService.commitFiles(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    result.forEach(file => {
      expect(file.modified).toBeFalsy();
      expect(file.originalConfig).toEqual(draftConfig);
      expect(file.draftConfig).toBeUndefined();
    });

    expect(pullStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(2);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(pathFinder1.repoDir)).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('force push should ignore confict files', async () => {

    await fileService.accessRepo(TestUser);

    commitStub.and.returnValue(commitOid2);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder1.repoFilePath]: file1.oid } } };

    const result = await fileService.commitFiles(principal, [file1, file2], 'test commit', true);

    expect(result.length).toEqual(2);
    result.forEach(file => {
      expect(file.modified).toBeFalsy();
      expect(file.originalConfig).toEqual(draftConfig);
      expect(file.draftConfig).toBeUndefined();
    });

    expect(readObjectStub.calls.count()).toEqual(0);
    expect(pullStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(2);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(pathFinder1.repoDir)).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('error expected when conflict files exist', async () => {
    await fileService.accessRepo(TestUser);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));
    originalConfig.environments.addChild(new TreeNode('prod'));

    const originalConfigObj = { object: utilService.convertTreeToYaml(originalConfig) };

    readObjectStub.and.returnValues(...objectTree, originalConfigObj, originalConfigObj);
    commitStub.and.returnValue(commitOid2);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {} } };

    try {
      await fileService.commitFiles(principal, [file1, file2], 'test commit');
      fail('err expected');
    } catch (err) {
      expect(err.message.indexOf('The following file(s) are already changed in the repository')).toBeGreaterThan(-1);

      expect(err.data.length).toEqual(2);
      err.data.forEach(file => {
        expect(file.draftConfig).toEqual(draftConfig);
        expect(file.originalConfig).toEqual(originalConfig);
      });
      expect(pullStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(0);
      expect(commitStub.calls.count()).toEqual(0);
      expect(pushStub.calls.count()).toEqual(0);

      // Head/Remote ref should not be updated
      assertHeadRef(commitOid1);
      assertRemoteRef(commitOid1);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(pathFinder1.repoDir)).toEqual(['.git']);

      // Draft file should not be deleted
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should be updated
      expect(principal.repoMetadata.commitBaseSHA).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
      const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
      expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
    }
  });

  it('commit changes failed when push, should reset to last commit', async () => {

    await fileService.accessRepo(TestUser);

    commitStub.and.returnValue(commitOid2);
    pushStub.and.throwError('mock push error');

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder1.repoFilePath]: file1.oid } } };

    try {
      await await fileService.commitFiles(principal, [file1, file2], 'test commit', true);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('mock push error')).toBeGreaterThan(-1);

      expect(pullStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(2);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadRef(commitOid1);
      assertRemoteRef(commitOid1);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(pathFinder1.repoDir)).toEqual(['.git']);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
    }
  });

  it('should resolve conflicts successfully', async () => {

    await fileService.accessRepo(TestUser);

    commitStub.and.returnValue(commitOid2);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));
    originalConfig.environments.addChild(new TreeNode('prod'));

    // changed file
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig,
      originalConfig: originalConfig
    };

    // unchanged file
    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
      oid: '222222',
      draftConfig: originalConfig,
      originalConfig: originalConfig
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder2.repoFilePath]: file2.oid } } };

    const result = await fileService.resovelConflicts(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    expect(result[0].modified).toBeFalsy();
    expect(result[1].modified).toBeFalsy();
    expect(result[0].originalConfig).toEqual(draftConfig);
    expect(result[1].originalConfig).toEqual(originalConfig);

    expect(pullStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadRef(commitOid2);
    assertRemoteRef(commitOid2);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(pathFinder2.repoDir)).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

  it('should resolve conflicts successfully, all files are not modified', async () => {

    await fileService.accessRepo(TestUser);

    commitStub.and.returnValue(commitOid2);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));
    originalConfig.environments.addChild(new TreeNode('prod'));

    // unchanged file
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: originalConfig,
      originalConfig: originalConfig
    };

    // unchanged file
    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
      oid: '222222',
      draftConfig: originalConfig,
      originalConfig: originalConfig
    };
    const pathFinder2 = new PathFinder(TestUser, file2);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: { [pathFinder2.repoFilePath]: file2.oid } } };

    const result = await fileService.resovelConflicts(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    expect(result[0].modified).toBeFalsy();
    expect(result[1].modified).toBeFalsy();
    expect(result[0].originalConfig).toEqual(originalConfig);
    expect(result[1].originalConfig).toEqual(originalConfig);

    expect(pullStub.calls.count()).toEqual(0);
    expect(addStub.calls.count()).toEqual(0);
    expect(commitStub.calls.count()).toEqual(0);
    expect(pushStub.calls.count()).toEqual(0);

    // Head/Remote ref should not be updated
    assertHeadRef(commitOid1);
    assertRemoteRef(commitOid1);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(pathFinder2.repoDir)).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA).toEqual({});
  });

});
