import * as path from 'path';
import * as _ from 'lodash';

import { TestUser, utilService } from '../test/test-helper';

import { percyConfig } from '../config';
import { MaintenanceService } from './maintenance.service';
import { FileManagementService, PathFinder } from './file-management.service';
import { git, FS } from './util.service';
import { Principal } from 'models/auth';
import { Configuration } from 'models/config-file';
import { TreeNode } from 'models/tree-node';

describe('FileManagementService', () => {

  let maintenanceService: MaintenanceService;

  const dir = PathFinder.getRepoDir(TestUser);
  const repoMetadataFile = utilService.getMetadataPath(TestUser.repoFolder);

  const newCommitOid = '2345346457658768345243523452234234234345';

  const commits = {
    master: '1234567890123456789012345678901234567890',
    [TestUser.branchName]: '6789012345678901234567890123456789012345',
  };

  const objectTree = [
    {
      object: { tree: commits.master }
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

  const PRINCIPAL: Principal = { user: TestUser, repoMetadata: { ...TestUser, commitBaseSHA: {}, version: '1.0' } };
  let principal: Principal;

  let fs: FS;
  let fileService: FileManagementService;

  let cloneStub: jasmine.Spy;
  let fetchStub: jasmine.Spy;
  let getRemoteInfoStub: jasmine.Spy;
  let listFilesStub: jasmine.Spy;
  let resetIndexStub: jasmine.Spy;
  let readObjectStub: jasmine.Spy;
  let writeObjectStub: jasmine.Spy;
  let addStub: jasmine.Spy;
  let removeStub: jasmine.Spy;
  let commitStub: jasmine.Spy;
  let pushStub: jasmine.Spy;

  beforeEach(async () => {
    principal = _.cloneDeep(PRINCIPAL);
    fs = await utilService.getBrowserFS();
    await fs.emptyDir(percyConfig.reposFolder);
    await fs.emptyDir(percyConfig.draftFolder);
    await fs.emptyDir(percyConfig.metaFolder);

    maintenanceService = new MaintenanceService(utilService);
    fileService = new FileManagementService(utilService, maintenanceService);

    cloneStub = spyOn(git, 'clone');
    cloneStub.and.callFake(async (ops) => {
      await git.init({ dir: ops.dir });

      // Set the remote commit
      await fs.mkdirs(path.resolve(ops.dir, '.git', 'refs', 'remotes', 'origin'));
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/master`,
        value: commits.master,
        force: true,
      });
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/${TestUser.branchName}`,
        value: commits[TestUser.branchName],
        force: true,
      });

      await git.config({ dir: ops.dir, path: 'remote.origin.url', value: TestUser.repositoryUrl });

      // Set the HEAD ref
      await git.writeRef({
        dir,
        ref: 'HEAD',
        value: `refs/heads/master`,
        symbolic: true,
        force: true,
      });

      // Set HEAD commit oid
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/heads/master`,
        value: commits.master,
        force: true,
      });
    });

    fetchStub = spyOn(git, 'fetch');
    fetchStub.and.callFake(async (ops) => {
      return { fetchHead: commits[ops.ref] };
    });

    getRemoteInfoStub = spyOn(git, 'getRemoteInfo');
    getRemoteInfoStub.and.returnValue({
      refs: {
        heads: {
          'master': commits.master,
          [TestUser.branchName]: commits.master,
        }
      }
    });

    listFilesStub = spyOn(git, 'listFiles');
    listFilesStub.and.returnValue([]);

    resetIndexStub = spyOn(git, 'resetIndex');
    readObjectStub = spyOn(git, 'readObject');
    writeObjectStub = spyOn(git, 'writeObject');
    addStub = spyOn(git, 'add');
    removeStub = spyOn(git, 'remove');
    commitStub = spyOn(git, 'commit');
    pushStub = spyOn(git, 'push');
  });

  const assertHeadCommit = async (branch: string, sha: string) => {
    expect(await git.resolveRef({ dir, ref: 'refs/heads/' + branch })).toEqual(sha);
  };

  const assertRemoteCommit = async (branch: string, sha: string) => {
    expect(await git.resolveRef({ dir, ref: 'refs/remotes/origin/' + branch })).toEqual(sha);
  };

  it('should clone repo successfully', async () => {

    const user = await fileService.accessRepo(TestUser);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect({ ..._.omit(user, 'password'), commitBaseSHA: {}, version: percyConfig.repoMetadataVersion })
      .toEqual(_.omit(metadata, 'password'));

    expect(cloneStub.calls.count()).toEqual(1);

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit('master', commits.master);
    assertRemoteCommit('master', commits.master);

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, TestUser.repoFolder);
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

  it('access already cloned repo should be successfully', async () => {

    await fileService.accessRepo(TestUser);

    fetchStub.and.callFake(async (ops) => {
      await git.writeRef({
        dir: ops.dir,
        ref: 'refs/remotes/origin/master',
        value: newCommitOid,
        force: true,
      });
      return { fetchHead: newCommitOid };
    });

    const user = await fileService.accessRepo(TestUser);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    expect({ ..._.omit(user, 'password'), commitBaseSHA: {}, version: percyConfig.repoMetadataVersion })
      .toEqual(_.omit(metadata, 'password'));

    expect(fetchStub.calls.count()).toEqual(1);
    expect(fetchStub.calls.first().args[0].singleBranch).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit('master', newCommitOid);
    assertRemoteCommit('master', newCommitOid);

    // Draft folder should be created
    const draftFolder = path.resolve(percyConfig.draftFolder, TestUser.repoFolder);
    expect(await fs.pathExists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(await maintenanceService.getUserTypeAhead(TestUser.username[0])).toEqual([TestUser.username]);
  });

  it('should list branches successfully', async () => {
    await fileService.accessRepo(TestUser);

    const branches = await fileService.listBranches(principal);

    expect(branches).toEqual(['master', TestUser.branchName].sort());
  });

  it('should switch branch successfully', async () => {
    await fileService.accessRepo(TestUser);

    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    const metadata = await fs.readJson(repoMetadataFile);
    expect(metadata.branchName).toEqual(TestUser.branchName);

    // Current branch should be switched
    expect(await git.currentBranch({ dir })).toEqual(TestUser.branchName);

    assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
    assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);
  });

  it('should create branch successfully', async () => {
    await fileService.accessRepo(TestUser);

    commitStub.and.returnValue(newCommitOid);
    await fileService.checkoutBranch(principal, 'create', 'branch1');

    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    const metadata = await fs.readJson(repoMetadataFile);
    expect(metadata.branchName).toEqual('branch1');

    // Current branch should be switched
    expect(await git.currentBranch({ dir })).toEqual('branch1');

    assertHeadCommit('branch1', newCommitOid);
    assertRemoteCommit('branch1', newCommitOid);
  });

  it('push fail, branch should not be created', async () => {
    await fileService.accessRepo(TestUser);

    pushStub.and.throwError('Mock push error');
    try {
      await fileService.checkoutBranch(principal, 'create', 'branch1');
      fail('should fail');
    } catch (err) {
      expect(err.message.indexOf('Mock push error') > -1).toBeTruthy();

      expect(await fs.pathExists(path.resolve(dir, '.git/refs/heads/branch1'))).toBeFalsy();

      // Current branch should not be switched
      expect(await git.currentBranch({ dir })).toEqual('master');

      const metadata = await fs.readJson(repoMetadataFile);
      expect(metadata.branchName).toEqual('master');
    }
  });

  it('branch already exist, should not be created again', async () => {
    await fileService.accessRepo(TestUser);

    fetchStub.and.callFake(async (ops) => {
      await git.writeRef({
        dir: ops.dir,
        ref: 'refs/remotes/origin/branch1',
        value: newCommitOid,
        force: true,
      });
      return { fetchHead: commits.master };
    });

    try {
      await fileService.checkoutBranch(principal, 'create', 'branch1');
      fail('should fail');
    } catch (err) {
      expect(err.message.indexOf('branch1 already exists') > -1).toBeTruthy();

      expect(await fs.pathExists(path.resolve(dir, '.git/refs/heads/branch1'))).toBeFalsy();

      const metadata = await fs.readJson(repoMetadataFile);
      expect(metadata.branchName).toEqual('master');
    }
  });

  it('should get branch diff successfully when no merge base found', async () => {
    await fileService.accessRepo(TestUser);

    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '999999' },
      { path: 'nest', type: 'tree' }
    ];
    readObjectStub.and.returnValues(
      { object: { parent: [] } },
      { object: { parent: [] } },
      ...objectTree,
      ...targetObjectTree,
      { type: 'blob', object: 'draftContent1' },
      { type: 'blob', object: 'draftContent2' },
      { type: 'blob', object: 'originalContent2' }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(principal, 'master', TestUser.branchName);

    expect(toSave.length).toEqual(1);
    expect(toDelete.length).toEqual(0);
    expect(conflictFiles.length).toEqual(1);
  });

  it('should get branch diff successfully when using 3-way diff', async () => {
    await fileService.accessRepo(TestUser);

    const srcObjectTree = _.cloneDeep(objectTree);
    srcObjectTree[srcObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '444444' },
      { path: 'app2-new.yaml', type: 'blob', oid: '555555' },
      { path: 'nest', type: 'tree' }
    ];
    const baseObjectTree = _.cloneDeep(objectTree);
    baseObjectTree[baseObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '999999' },
      { path: 'app2-server.yaml', type: 'blob', oid: '000000' },
      { path: 'nest', type: 'tree' }
    ];

    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '888888' },
      { path: 'app2-new.yaml', type: 'blob', oid: '999999' },
      { path: 'app2-server.yaml', type: 'blob', oid: '000000' },
      { path: 'nest', type: 'tree' }
    ];

    readObjectStub.and.returnValues(
      { object: { parent: ['111111'] } },
      { object: { parent: [] } },
      { object: { parent: ['111111'] } },
      ...srcObjectTree,
      ...targetObjectTree,
      ...baseObjectTree,
      { type: 'blob', object: 'draftContent1' },
      { type: 'blob', object: 'draftContent2' },
      { type: 'blob', object: 'originalContent1' },
      { type: 'blob', object: 'originalContent2' }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(principal, 'master', TestUser.branchName);

    expect(toSave.length).toEqual(0);
    expect(toDelete.length).toEqual(1);
    expect(toDelete[0].fileName).toEqual('app2-server.yaml');
    expect(conflictFiles.length).toEqual(2);
    expect(conflictFiles[0].fileName).toEqual('app2-new.yaml');
    expect(conflictFiles[1].fileName).toEqual('app2-client.yaml');
  });

  it('should get branch diff successfully when merge base is target branch head commit', async () => {
    await fileService.accessRepo(TestUser);

    const srcObjectTree = _.cloneDeep(objectTree);
    srcObjectTree[srcObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '444444' },
      { path: 'app2-new.yaml', type: 'blob', oid: '555555' },
      { path: 'nest', type: 'tree' }
    ];
    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: 'app2-client.yaml', type: 'blob', oid: '999999' },
      { path: 'app2-server.yaml', type: 'blob', oid: '000000' },
      { path: 'nest', type: 'tree' }
    ];

    readObjectStub.and.returnValues(
      { object: { parent: [] } },
      { object: { parent: [commits[TestUser.branchName]] } },
      ...srcObjectTree,
      ...targetObjectTree,
      { type: 'blob', object: 'draftContent1' },
      { type: 'blob', object: 'draftContent2' },
      { type: 'blob', object: 'originalContent2' }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(principal, 'master', TestUser.branchName);

    expect(toSave.length).toEqual(2);
    expect(toSave[0].fileName).toEqual('app2-new.yaml');
    expect(toSave[1].fileName).toEqual('app2-client.yaml');
    expect(toDelete.length).toEqual(1);
    expect(toDelete[0].fileName).toEqual('app2-server.yaml');
    expect(conflictFiles.length).toEqual(0);
  });

  it('should get empty diff when merge base is source branch head commit', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.returnValues(
      { object: { parent: [commits.master] } },
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(principal, 'master', TestUser.branchName);

    expect(toSave.length).toEqual(0);
    expect(toDelete.length).toEqual(0);
    expect(conflictFiles.length).toEqual(0);
  });

  it('should merge branch successfully', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.returnValues(
      { object: { parent: [commits[TestUser.branchName]] } },
    );
    listFilesStub.and.returnValue(['a.txt']);

    writeObjectStub.and.returnValue(newCommitOid);
    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: '111111',
      draftContent: utilService.convertTreeToYaml(draftConfig)
    };
    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
      oid: '222222',
    };

    await fileService.mergeBranch(principal, 'master', TestUser.branchName, { toSave: [file1], toDelete: [file2] });

    expect(addStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(readObjectStub.calls.count()).toEqual(1);
    expect(writeObjectStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Merge commit should be created with two parents
    expect(writeObjectStub.calls.first().args[0].object.parent).toEqual([commits[TestUser.branchName], commits.master]);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);
    expect(resetIndexStub.calls.count()).toEqual(2);
  });

  it('should refresh repo successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    fetchStub.and.callFake(async (ops) => {
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/${TestUser.branchName}`,
        value: newCommitOid,
        force: true,
      });
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/master`,
        value: newCommitOid,
        force: true,
      });
      return { fetchHead: newCommitOid };
    });

    const { pulledCommit, branchChanged, masterChanged } = await fileService.refresh(principal);
    expect(pulledCommit).toEqual(newCommitOid);
    expect(branchChanged).toBeTruthy();
    expect(masterChanged).toBeTruthy();

    expect(fetchStub.calls.count()).toEqual(1);
    expect(fetchStub.calls.first().args[0].singleBranch).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);
  });

  it('should refresh repo when remote branch deleted', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    fetchStub.and.callFake(async () => {
      const error = new Error();
      error['code'] = git.E.ResolveRefError;
      throw error;
    });

    const { pulledCommit, branchChanged, masterChanged } = await fileService.refresh(principal);
    expect(pulledCommit).toEqual(commits[TestUser.branchName]);
    expect(branchChanged).toBeFalsy();
    expect(masterChanged).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
    assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);
  });

  it('refresh repo fails, error expected', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    fetchStub.and.callFake(async () => {
      const error = new Error('Mock fetch error');
      throw error;
    });

    try {
      await fileService.refresh(principal);
      fail('should fail');
    } catch (err) {
      expect(err.message.indexOf('Mock fetch error') > -1).toBeTruthy();
    }
  });

  it('should get app environments successfully', async () => {
    await fileService.accessRepo(TestUser);

    const appPercyConf = { key: 'value' };

    const config = new Configuration();
    config.environments.addChild(new TreeNode('dev'));
    config.environments.addChild(new TreeNode('qat'));
    config.environments.addChild(new TreeNode('prod'));

    readObjectStub.and.callFake((options) => {
      if (options.filepath.indexOf('environments') > -1) {
        return { object: utilService.convertTreeToYaml(config), type: 'blob' };
      }
      if (options.filepath.indexOf(percyConfig.yamlAppsFolder + '/app1/' + '.percyrc') > -1) {
        return { object: JSON.stringify(appPercyConf), type: 'blob' };
      }
      throw { code: git.E.TreeOrBlobNotFoundError };
    });

    const envs = await fileService.getEnvironments(principal, 'app1');

    expect(readObjectStub.calls.count()).toEqual(3);

    expect(envs.environments).toEqual(['dev', 'qat', 'prod']);
    expect(envs.appPercyConfig).toEqual(appPercyConf);
  });

  it('should get an empty array when environments file does not exists', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.callFake(() => {
      throw { code: git.E.TreeOrBlobNotFoundError };
    });
    const envs = await fileService.getEnvironments(principal, 'app1');

    expect(readObjectStub.calls.count()).toEqual(3);

    expect(envs.environments).toEqual([]);
  });

  it('should get files successfully', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.returnValues(...objectTree, ...objectTree, { object: { parent: [] } }, { object: { parent: [] } });

    const draftPath = path.resolve(percyConfig.draftFolder, TestUser.repoFolder, TestUser.branchName);
    const draftAppsPath = path.resolve(draftPath, percyConfig.yamlAppsFolder);
    await fs.mkdirs(draftAppsPath);
    await fs.mkdirs(draftAppsPath + '/app1');
    await fs.mkdirs(draftAppsPath + '/app2/nest');
    await fs.writeFile(draftAppsPath + '/test.txt', 'text');
    await fs.writeFile(draftAppsPath + '/app1/app1-client.yaml', '{}');
    await fs.writeFile(draftAppsPath + '/app2/test.txt', 'text');

    const result = await fileService.getFiles(principal);

    expect(result.canPullRequest).toBeFalsy();
    expect(result.canSyncMaster).toBeFalsy();
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
    await fileService.accessRepo(TestUser);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ oid: '222333', type: 'blob', object: utilService.convertTreeToYaml(originalConfig) });

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    draftConfig.environments.addChild(new TreeNode('prod'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, oid: '222333', modified: true, originalConfig, draftConfig });
  });

  it('should get file content and remove draft file if it\'s same', async () => {
    await fileService.accessRepo(TestUser);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ oid: '222333', type: 'blob', object: utilService.convertTreeToYaml(originalConfig) });

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(originalConfig));

    const result = await fileService.getFileContent(principal, file);

    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();
    expect(result).toEqual({ ...file, oid: '222333', modified: false, originalConfig, draftConfig: undefined });
  });

  it('should get file content without draft config successfully', async () => {
    await fileService.accessRepo(TestUser);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));

    readObjectStub.and.returnValue({ oid: '222333', type: 'blob', object: utilService.convertTreeToYaml(originalConfig) });

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.remove(pathFinder.draftFullFilePath);

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, oid: '222333', modified: false, originalConfig });
  });

  it('should get file content without original config successfully', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.callFake(() => {
      throw { code: git.E.TreeOrBlobNotFoundError };
    });

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    draftConfig.environments.addChild(new TreeNode('prod'));

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, modified: true, draftConfig });
  });

  it('error expected if both original config and draft config missing', async () => {
    await fileService.accessRepo(TestUser);

    readObjectStub.and.callFake(() => {
      throw { code: git.E.TreeOrBlobNotFoundError };
    });

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml'
    };

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.remove(pathFinder.draftFullFilePath);

    try {
      await fileService.getFileContent(principal, file);
      fail('error expected');
    } catch (err) {
      expect(/File (.*) does not exist/.test(err.message)).toBeTruthy();
    }
  });

  it('should save draft file successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

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

    await fileService.saveDraft(principal, file);

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);

    const draftFile = await fs.readFile(pathFinder.draftFullFilePath);
    expect(utilService.parseYamlConfig(draftFile.toString())).toEqual(draftConfig);

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder.repoFilePath]: file.oid });
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder.repoFilePath]: file.oid });
  });

  it('save draft file which is same as original file, draft file should be deleted', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

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

    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.mkdirs(pathFinder.repoAppDir);
    await fs.writeFile(pathFinder.fullFilePath, utilService.convertTreeToYaml(originalConfig));
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(originalConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder.repoFilePath]: file.oid } },
        version: '1.0'
      }
    };

    await fileService.saveDraft(principal, file);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('should delete draft-only file successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    readObjectStub.and.callFake(() => {
      throw { code: git.E.TreeOrBlobNotFoundError };
    });

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
    };
    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    const result = await fileService.deleteFile(principal, file);

    // Should not be pulled
    expect(result).toBeFalsy();
    expect(fetchStub.calls.count()).toEqual(0);
    expect(removeStub.calls.count()).toEqual(0);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();
  });

  it('should delete both draft and original file successfully', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    readObjectStub.and.callFake(() => {
    });

    commitStub.and.returnValue(newCommitOid);

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };
    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder.repoFilePath]: file.oid } },
        version: '1.0'
      }
    };
    const result = await fileService.deleteFile(principal, file);

    // Should pushed to repo
    expect(result).toBeFalsy();
    expect(fetchStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('should delete original-only file successfully', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    readObjectStub.and.callFake(() => {
    });
    commitStub.and.returnValue(newCommitOid);

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };

    const result = await fileService.deleteFile(principal, file);

    // Should pushed to repo
    expect(result).toBeFalsy();
    expect(fetchStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('delete failed when push, should reset to last commit', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    readObjectStub.and.callFake(() => {
    });
    commitStub.and.returnValue(newCommitOid);
    pushStub.and.throwError('mock push error');

    const file = {
      applicationName: 'app1',
      fileName: 'config.yaml',
      oid: '223344'
    };
    const pathFinder = new PathFinder(TestUser, file, TestUser.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(pathFinder.draftFullFilePath, utilService.convertTreeToYaml(new Configuration()));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder.repoFilePath]: file.oid } },
        version: '1.0'
      }
    };
    try {
      await fileService.deleteFile(principal, file);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('mock push error')).toBeGreaterThan(-1);
      expect(fetchStub.calls.count()).toEqual(1);
      expect(removeStub.calls.count()).toEqual(1);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
      assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder.repoFilePath]: file.oid });
    }
  });

  it('should commit changed files successfully', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    readObjectStub.and.returnValues(...objectTree);
    commitStub.and.returnValue(newCommitOid);
    listFilesStub.and.returnValue(['a.txt']);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: '111111',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1, TestUser.branchName);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
      oid: '222222'
    };
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder1.repoFilePath]: file1.oid } },
        version: '1.0'
      }
    };
    const result = await fileService.commitFiles(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    result.forEach(file => {
      expect(file.modified).toBeFalsy();
      expect(file.originalConfig).toEqual(draftConfig);
      expect(file.draftConfig).toBeUndefined();
    });

    expect(fetchStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(2);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);
    expect(resetIndexStub.calls.count()).toEqual(2);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('force push should ignore confict files', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1, TestUser.branchName);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder1.repoFilePath]: file1.oid } },
        version: '1.0'
      }
    };
    const result = await fileService.commitFiles(principal, [file1, file2], 'test commit', true);

    expect(result.length).toEqual(2);
    result.forEach(file => {
      expect(file.modified).toBeFalsy();
      expect(file.originalConfig).toEqual(draftConfig);
      expect(file.draftConfig).toBeUndefined();
    });

    expect(readObjectStub.calls.count()).toEqual(0);
    expect(fetchStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(2);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('error expected when conflict files exist', async () => {
    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode('dev'));
    originalConfig.environments.addChild(new TreeNode('qat'));
    originalConfig.environments.addChild(new TreeNode('prod'));

    const originalConfigObj = { object: utilService.convertTreeToYaml(originalConfig), type: 'blob' };

    readObjectStub.and.returnValues(...objectTree, originalConfigObj, originalConfigObj);
    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode('dev'));
    draftConfig.environments.addChild(new TreeNode('qat'));
    const file1 = {
      applicationName: 'app1',
      fileName: 'app1-client.yaml',
      oid: 'changed-oid',
      draftConfig: draftConfig
    };
    const pathFinder1 = new PathFinder(TestUser, file1, TestUser.branchName);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

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
      expect(fetchStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(0);
      expect(commitStub.calls.count()).toEqual(0);
      expect(pushStub.calls.count()).toEqual(0);

      // Head/Remote ref should not be updated
      assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
      assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);

      // Draft file should not be deleted
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should be updated
      expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
      const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
      expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
    }
  });

  it('commit changes failed when push, should reset to last commit', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    commitStub.and.returnValue(newCommitOid);
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
    const pathFinder1 = new PathFinder(TestUser, file1, TestUser.branchName);

    const file2 = {
      applicationName: 'app1',
      fileName: 'app1-server.yaml',
    };
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder1.repoFilePath]: file1.oid } },
        version: '1.0'
      }
    };
    try {
      await fileService.commitFiles(principal, [file1, file2], 'test commit', true);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('mock push error')).toBeGreaterThan(-1);

      expect(fetchStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(2);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
      assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
    }
  });

  it('should resolve conflicts successfully', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    commitStub.and.returnValue(newCommitOid);

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
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder2.repoFilePath]: file2.oid } },
        version: '1.0'
      }
    };
    const result = await fileService.resovelConflicts(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    expect(result[0].modified).toBeFalsy();
    expect(result[1].modified).toBeFalsy();
    expect(result[0].originalConfig).toEqual(draftConfig);
    expect(result[1].originalConfig).toEqual(originalConfig);

    expect(fetchStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TestUser.branchName, newCommitOid);
    assertRemoteCommit(TestUser.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });

  it('should resolve conflicts successfully, all files are not modified', async () => {

    await fileService.accessRepo(TestUser);
    await fileService.checkoutBranch(principal, 'switch', TestUser.branchName);

    commitStub.and.returnValue(newCommitOid);

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
    const pathFinder2 = new PathFinder(TestUser, file2, TestUser.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(pathFinder2.draftFullFilePath, utilService.convertTreeToYaml(draftConfig));

    principal = {
      user: TestUser,
      repoMetadata: {
        ...TestUser,
        commitBaseSHA: { [TestUser.branchName]: { [pathFinder2.repoFilePath]: file2.oid } },
        version: '1.0'
      }
    };
    const result = await fileService.resovelConflicts(principal, [file1, file2], 'test commit');

    expect(result.length).toEqual(2);
    expect(result[0].modified).toBeFalsy();
    expect(result[1].modified).toBeFalsy();
    expect(result[0].originalConfig).toEqual(originalConfig);
    expect(result[1].originalConfig).toEqual(originalConfig);

    expect(fetchStub.calls.count()).toEqual(0);
    expect(addStub.calls.count()).toEqual(0);
    expect(commitStub.calls.count()).toEqual(0);
    expect(pushStub.calls.count()).toEqual(0);

    // Head/Remote ref should not be updated
    assertHeadCommit(TestUser.branchName, commits[TestUser.branchName]);
    assertRemoteCommit(TestUser.branchName, commits[TestUser.branchName]);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TestUser))).toEqual(['.git']);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TestUser.branchName]).toEqual({});
    const metadataFile = utilService.getMetadataPath(TestUser.repoFolder);
    expect((await fs.readJson(metadataFile)).commitBaseSHA[TestUser.branchName]).toEqual({});
  });
});
