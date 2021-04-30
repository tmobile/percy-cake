/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import * as path from "path";
import * as _ from "lodash";

import { TEST_USER, utilService } from "../test/test-helper";

import { percyConfig } from "../config";
import { MaintenanceService } from "./maintenance.service";
import { FileManagementService, PathFinder } from "./file-management.service";
import { git, FS } from "./util.service";
import { Principal } from "models/auth";
import { Configuration, FileTypes } from "models/config-file";
import { TreeNode } from "models/tree-node";

class TreeOrBlobNotFoundError extends Error {
    code = git.E.TreeOrBlobNotFoundError;
}

describe("FileManagementService", () => {
  let maintenanceService: MaintenanceService;

  const dir = PathFinder.getRepoDir(TEST_USER);
  const repoMetadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);

  const newCommitOid = "2345346457658768345243523452234234234345";

  const commits = {
    master: "1234567890123456789012345678901234567890",
    [TEST_USER.branchName]: "6789012345678901234567890123456789012345"
  };

  const objectTree = [
    {
      object: { tree: commits.master }
    },
    {
      object: {
        entries: [
          { path: "README.md", type: "blob", oid: "666666" },
          { path: "Blockquote.md", type: "blob", oid: "777777" },
          { path: "text-file.txt", type: "blob" },
          { path: percyConfig.yamlAppsFolder, type: "tree" }
        ]
      }
    },
    {
      object: {
        entries: [
          { path: "app1", type: "tree" },
          { path: "app2", type: "tree" },
          { path: "app3", type: "tree" },
          { path: ".percyrc", type: "blob", oid: "888888" },
          { path: "Test.md", type: "blob", oid: "999999" },
          { path: ".gitignore", type: "blob" }
        ]
      }
    },
    {
      object: {
        entries: [
          { path: "app1-client.yaml", type: "blob", oid: "111111" },
          { path: "app1-server.yaml", type: "blob", oid: "222222" },
          { path: "environments.yml", type: "blob", oid: "333333" },
          { path: "test.md", type: "blob", oid: "aaaaaa" },
          { path: ".percyrc", type: "blob", oid: "bbbbbb"},
          { path: ".gitignore", type: "blob" }
        ]
      }
    },
    {
      object: {
        entries: [
          { path: "app2-client.yaml", type: "blob", oid: "444444" },
          { path: "app2-server.yaml", type: "blob", oid: "555555" },
          { path: "nest", type: "tree" }
        ]
      }
    },
    {
      object: {
        entries: [{ path: "app3-empty.txt", type: "blob" }]
      }
    }
  ];

  const PRINCIPAL: Principal = {
    user: TEST_USER,
    repoMetadata: { ...TEST_USER, commitBaseSHA: {}, version: "1.0" }
  };
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

    cloneStub = spyOn(git, "clone");
    cloneStub.and.callFake(async ops => {
      await git.init({ dir: ops.dir });

      // Set the remote commit
      await fs.mkdirs(
        path.resolve(ops.dir, ".git", "refs", "remotes", "origin")
      );
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/master`,
        value: commits.master,
        force: true
      });
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/${TEST_USER.branchName}`,
        value: commits[TEST_USER.branchName],
        force: true
      });

      await git.config({
        dir: ops.dir,
        path: "remote.origin.url",
        value: TEST_USER.repositoryUrl
      });

      // Set the HEAD ref
      await git.writeRef({
        dir,
        ref: "HEAD",
        value: `refs/heads/master`,
        symbolic: true,
        force: true
      });

      // Set HEAD commit oid
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/heads/master`,
        value: commits.master,
        force: true
      });
    });

    fetchStub = spyOn(git, "fetch");
    fetchStub.and.callFake(async ops => ({ fetchHead: commits[ops.ref] }));

    getRemoteInfoStub = spyOn(git, "getRemoteInfo");
    getRemoteInfoStub.and.returnValue({
      refs: {
        heads: {
          master: commits.master,
          [TEST_USER.branchName]: commits.master
        }
      }
    });

    listFilesStub = spyOn(git, "listFiles");
    listFilesStub.and.returnValue([]);

    resetIndexStub = spyOn(git, "resetIndex");
    readObjectStub = spyOn(git, "readObject");
    writeObjectStub = spyOn(git, "writeObject");
    addStub = spyOn(git, "add");
    removeStub = spyOn(git, "remove");
    commitStub = spyOn(git, "commit");
    pushStub = spyOn(git, "push");
  });

  const assertHeadCommit = async (branch: string, sha: string) => {
    expect(await git.resolveRef({ dir, ref: "refs/heads/" + branch })).toEqual(
      sha
    );
  };

  const assertRemoteCommit = async (branch: string, sha: string) => {
    expect(
      await git.resolveRef({ dir, ref: "refs/remotes/origin/" + branch })
    ).toEqual(sha);
  };

  const assertMetadata = (user, metadata) => {
    expect(user.branchName).toEqual(metadata.branchName);
    expect(user.repoFolder).toEqual(metadata.repoFolder);
    expect(user.repoName).toEqual(metadata.repoName);
    expect(user.repositoryUrl).toEqual(metadata.repositoryUrl);
    expect(user.token).toEqual(metadata.token);
    expect(user.username).toEqual(metadata.username);
    expect({}).toEqual(metadata.commitBaseSHA);
    expect(percyConfig.repoMetadataVersion).toEqual(metadata.version);
  };

  it("should clone repo successfully", async () => {
    const user = await fileService.accessRepo(TEST_USER);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    assertMetadata(user, metadata);

    expect(cloneStub.calls.count()).toEqual(1);

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit("master", commits.master);
    assertRemoteCommit("master", commits.master);

    // Draft folder should be created
    const draftFolder = path.resolve(
      percyConfig.draftFolder,
      TEST_USER.repoFolder
    );
    expect(await fs.pathExists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(
      await maintenanceService.getUserTypeAhead(TEST_USER.username[0])
    ).toEqual([TEST_USER.username]);
  });

  it("repo exists but metadata missing, should clone repo again", async () => {
    cloneStub.and.throwError("Mock clone error");

    await fs.mkdirs(dir);
    await fs.remove(repoMetadataFile);

    try {
      await fileService.accessRepo(TEST_USER);
      fail("should clone again");
    } catch (err) {
      expect(err.message.indexOf("Mock clone error") > -1).toBeTruthy();
    }
  });

  it("repo exists but metadata broken, should clone repo again", async () => {
    cloneStub.and.throwError("Mock clone error");

    await fs.mkdirs(dir);
    await fs.writeFile(repoMetadataFile, "Not a JSON file");

    try {
      await fileService.accessRepo(TEST_USER);
      fail("should clone again");
    } catch (err) {
      expect(err.message.indexOf("Mock clone error") > -1).toBeTruthy();
    }
  });

  it("repo exists but metadata version changes, should clone repo again", async () => {
    cloneStub.and.throwError("Mock clone error");

    await fs.mkdirs(dir);
    const metadata = {
      ...TEST_USER,
      version: percyConfig.repoMetadataVersion + "1"
    };
    await fs.outputJson(repoMetadataFile, metadata);

    try {
      await fileService.accessRepo(TEST_USER);
      fail("should clone again");
    } catch (err) {
      expect(err.message.indexOf("Mock clone error") > -1).toBeTruthy();
    }
  });

  it("access already cloned repo should be successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    fetchStub.and.callFake(async ops => {
      await git.writeRef({
        dir: ops.dir,
        ref: "refs/remotes/origin/master",
        value: newCommitOid,
        force: true
      });
      return { fetchHead: newCommitOid };
    });

    const user = await fileService.accessRepo(TEST_USER);

    // Repo metadata should be written
    const metadata = await fs.readJson(repoMetadataFile);
    assertMetadata(user, metadata);

    expect(fetchStub.calls.count()).toEqual(1);
    expect(fetchStub.calls.first().args[0].singleBranch).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit("master", newCommitOid);
    assertRemoteCommit("master", newCommitOid);

    // Draft folder should be created
    const draftFolder = path.resolve(
      percyConfig.draftFolder,
      TEST_USER.repoFolder
    );
    expect(await fs.pathExists(draftFolder)).toBeTruthy();

    // User name should be added to type ahead
    expect(
      await maintenanceService.getUserTypeAhead(TEST_USER.username[0])
    ).toEqual([TEST_USER.username]);
  });

  it("should list branches successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    const branches = await fileService.listBranches(principal);

    expect(branches).toEqual(["master", TEST_USER.branchName].sort());
  });

  it("should switch branch successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    const metadata = await fs.readJson(repoMetadataFile);
    expect(metadata.branchName).toEqual(TEST_USER.branchName);

    // Current branch should be switched
    expect(await git.currentBranch({ dir })).toEqual(TEST_USER.branchName);

    assertHeadCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
    assertRemoteCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
  });

  it("should create branch successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    commitStub.and.returnValue(newCommitOid);
    await fileService.checkoutBranch(principal, "create", "branch1");

    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    const metadata = await fs.readJson(repoMetadataFile);
    expect(metadata.branchName).toEqual("branch1");

    // Current branch should be switched
    expect(await git.currentBranch({ dir })).toEqual("branch1");

    assertHeadCommit("branch1", newCommitOid);
    assertRemoteCommit("branch1", newCommitOid);
  });

  it("push fail, branch should not be created", async () => {
    await fileService.accessRepo(TEST_USER);

    pushStub.and.throwError("Mock push error");
    try {
      await fileService.checkoutBranch(principal, "create", "branch1");
      fail("should fail");
    } catch (err) {
      expect(err.message.indexOf("Mock push error") > -1).toBeTruthy();

      expect(
        await fs.pathExists(path.resolve(dir, ".git/refs/heads/branch1"))
      ).toBeFalsy();

      // Current branch should not be switched
      expect(await git.currentBranch({ dir })).toEqual("master");

      const metadata = await fs.readJson(repoMetadataFile);
      expect(metadata.branchName).toEqual("master");
    }
  });

  it("branch already exist, should not be created again", async () => {
    await fileService.accessRepo(TEST_USER);

    getRemoteInfoStub.and.returnValue({
      refs: {
        heads: {
          master: commits.master,
          [TEST_USER.branchName]: commits.master,
          branch1: newCommitOid
        }
      }
    });

    try {
      await fileService.checkoutBranch(principal, "create", "branch1");
      fail("should fail");
    } catch (err) {
      expect(err.message.indexOf("branch1 already exists") > -1).toBeTruthy();

      expect(
        await fs.pathExists(path.resolve(dir, ".git/refs/heads/branch1"))
      ).toBeFalsy();

      const metadata = await fs.readJson(repoMetadataFile);
      expect(metadata.branchName).toEqual("master");
    }
  });

  it("should get branch diff successfully when no merge base found", async () => {
    await fileService.accessRepo(TEST_USER);

    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "999999" },
      { path: "nest", type: "tree" }
    ];
    readObjectStub.and.returnValues(
      { object: { parent: [] } },
      { object: { parent: [] } },
      ...objectTree,
      ...targetObjectTree,
      { type: "blob", object: "draftContent1" },
      { type: "blob", object: "draftContent2" },
      { type: "blob", object: "originalContent2" }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(
      principal,
      "master",
      TEST_USER.branchName
    );

    expect(toSave.length).toEqual(1);
    expect(toDelete.length).toEqual(0);
    expect(conflictFiles.length).toEqual(1);
  });

  it("should get branch diff successfully when using 3-way diff", async () => {
    await fileService.accessRepo(TEST_USER);

    const srcObjectTree = _.cloneDeep(objectTree);
    srcObjectTree[srcObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "444444" },
      { path: "app2-new.yaml", type: "blob", oid: "555555" },
      { path: "nest", type: "tree" }
    ];
    const baseObjectTree = _.cloneDeep(objectTree);
    baseObjectTree[baseObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "999999" },
      { path: "app2-server.yaml", type: "blob", oid: "000000" },
      { path: "nest", type: "tree" }
    ];

    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "888888" },
      { path: "app2-new.yaml", type: "blob", oid: "999999" },
      { path: "app2-server.yaml", type: "blob", oid: "000000" },
      { path: "nest", type: "tree" }
    ];

    readObjectStub.and.returnValues(
      { object: { parent: ["111111"] } },
      { object: { parent: [] } },
      { object: { parent: ["111111"] } },
      ...srcObjectTree,
      ...targetObjectTree,
      ...baseObjectTree,
      { type: "blob", object: "draftContent1" },
      { type: "blob", object: "draftContent2" },
      { type: "blob", object: "originalContent1" },
      { type: "blob", object: "originalContent2" }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(
      principal,
      "master",
      TEST_USER.branchName
    );

    expect(toSave.length).toEqual(0);
    expect(toDelete.length).toEqual(1);
    expect(toDelete[0].fileName).toEqual("app2-server.yaml");
    expect(conflictFiles.length).toEqual(2);
    expect(conflictFiles[0].fileName).toEqual("app2-new.yaml");
    expect(conflictFiles[1].fileName).toEqual("app2-client.yaml");
  });

  it("should get branch diff successfully when merge base is target branch head commit", async () => {
    await fileService.accessRepo(TEST_USER);

    const srcObjectTree = _.cloneDeep(objectTree);
    srcObjectTree[srcObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "444444" },
      { path: "app2-new.yaml", type: "blob", oid: "555555" },
      { path: "nest", type: "tree" }
    ];
    const targetObjectTree = _.cloneDeep(objectTree);
    targetObjectTree[targetObjectTree.length - 2].object.entries = [
      { path: "app2-client.yaml", type: "blob", oid: "999999" },
      { path: "app2-server.yaml", type: "blob", oid: "000000" },
      { path: "nest", type: "tree" }
    ];

    readObjectStub.and.returnValues(
      { object: { parent: [] } },
      { object: { parent: [commits[TEST_USER.branchName]] } },
      ...srcObjectTree,
      ...targetObjectTree,
      { type: "blob", object: "draftContent1" },
      { type: "blob", object: "draftContent2" },
      { type: "blob", object: "originalContent2" }
    );

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(
      principal,
      "master",
      TEST_USER.branchName
    );

    expect(toSave.length).toEqual(2);
    expect(toSave[0].fileName).toEqual("app2-new.yaml");
    expect(toSave[1].fileName).toEqual("app2-client.yaml");
    expect(toDelete.length).toEqual(1);
    expect(toDelete[0].fileName).toEqual("app2-server.yaml");
    expect(conflictFiles.length).toEqual(0);
  });

  it("should get empty diff when merge base is source branch head commit", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.returnValues({ object: { parent: [commits.master] } });

    const { toSave, toDelete, conflictFiles } = await fileService.branchDiff(
      principal,
      "master",
      TEST_USER.branchName
    );

    expect(toSave.length).toEqual(0);
    expect(toDelete.length).toEqual(0);
    expect(conflictFiles.length).toEqual(0);
  });

  it("should merge branch successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.returnValues({
      object: { parent: [commits[TEST_USER.branchName]] }
    });
    listFilesStub.and.returnValue(["a.txt"]);

    writeObjectStub.and.returnValue(newCommitOid);
    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "111111",
      draftContent: utilService.convertTreeToYaml(draftConfig)
    };
    const file2 = {
      applicationName: "app1",
      fileName: "app1-server.yaml",
      fileType: FileTypes.YAML,
      oid: "222222"
    };
    const file3 = {
      applicationName: "",
      fileName: "README.md",
      fileType: FileTypes.MD,
      oid: "666666",
      draftContent: "text"
    };

    await fileService.mergeBranch(principal, "master", TEST_USER.branchName, {
      toSave: [file1, file3],
      toDelete: [file2]
    });

    expect(addStub.calls.count()).toEqual(2);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(readObjectStub.calls.count()).toEqual(1);
    expect(writeObjectStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Merge commit should be created with two parents
    expect(writeObjectStub.calls.first().args[0].object.parent).toEqual([
      commits[TEST_USER.branchName],
      commits.master
    ]);

    // Head/Remote ref should be updated
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([".git"]);
    expect(resetIndexStub.calls.count()).toEqual(2);
  });

  it("should refresh repo successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    fetchStub.and.callFake(async ops => {
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/${TEST_USER.branchName}`,
        value: newCommitOid,
        force: true
      });
      await git.writeRef({
        dir: ops.dir,
        ref: `refs/remotes/origin/master`,
        value: newCommitOid,
        force: true
      });
      return { fetchHead: newCommitOid };
    });

    const {
      pulledCommit,
      branchChanged,
      masterChanged
    } = await fileService.refresh(principal);
    expect(pulledCommit).toEqual(newCommitOid);
    expect(branchChanged).toBeTruthy();
    expect(masterChanged).toBeTruthy();

    expect(fetchStub.calls.count()).toEqual(1);
    expect(fetchStub.calls.first().args[0].singleBranch).toBeFalsy();

    // Head SHA ref should be same as remotes SHA
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);
  });

  it("should refresh repo when remote branch deleted", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    getRemoteInfoStub.and.returnValue({
      refs: {
        heads: {
          master: commits.master
        }
      }
    });

    try {
      await fileService.refresh(principal);
      fail("should fail");
    } catch (err) {
      expect(
        err.message.indexOf(
          `Branch ${TEST_USER.branchName} has been deleted in remote repo`
        ) > -1
      ).toBeTruthy();
    }
  });

  it("refresh repo fails, error expected", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    fetchStub.and.callFake(async () => {
      const error = new Error("Mock fetch error");
      throw error;
    });

    try {
      await fileService.refresh(principal);
      fail("should fail");
    } catch (err) {
      expect(err.message.indexOf("Mock fetch error") > -1).toBeTruthy();
    }
  });

  it("should get app environments successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    const appPercyConfRepo = { key: "value", key2: "value" };
    const appPercyConfDraft = { key: "draft" };

    const config = new Configuration();
    config.environments.addChild(new TreeNode("dev"));
    config.environments.addChild(new TreeNode("qat"));
    config.environments.addChild(new TreeNode("prod"));

    readObjectStub.and.callFake(options => {
      if (options.filepath.indexOf("environments") > -1) {
        return { object: utilService.convertTreeToYaml(config), type: "blob" };
      }
      if (
        options.filepath.indexOf(
          percyConfig.yamlAppsFolder + "/app1/" + ".percyrc"
        ) > -1
      ) {
        return { object: JSON.stringify(appPercyConfRepo), type: "blob" };
      }
      throw new TreeOrBlobNotFoundError();
    });

    let envs = await fileService.getEnvironments(principal, "app1");

    expect(readObjectStub.calls.count()).toEqual(3);

    expect(envs.environments).toEqual(["dev", "qat", "prod"]);
    expect(envs.appPercyConfig).toEqual(appPercyConfRepo);


    // appPercyConfig overridden by apps draft percy file
    const draftPath = path.resolve(
      percyConfig.draftFolder,
      TEST_USER.repoFolder,
      TEST_USER.branchName
    );
    const draftAppsPath = path.resolve(draftPath, percyConfig.yamlAppsFolder);
    await fs.mkdirs(draftAppsPath);
    await fs.writeFile(draftAppsPath + "/.percyrc", JSON.stringify(appPercyConfDraft));

    envs = await fileService.getEnvironments(principal, "app1");
    expect(envs.appPercyConfig).toEqual({ ...appPercyConfDraft, ...appPercyConfRepo });

    // appPercyConfig overridden by app draft percy file
    await fs.remove(draftAppsPath + "/.percyrc");
    await fs.mkdirs(draftAppsPath + "/app1");
    await fs.writeFile(draftAppsPath + "/app1/.percyrc", JSON.stringify(appPercyConfDraft));

    envs = await fileService.getEnvironments(principal, "app1");
    expect(envs.appPercyConfig).toEqual(appPercyConfDraft);
  });

  it("should get an empty array when environments file does not exists", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.callFake(() => {
      throw new TreeOrBlobNotFoundError();
    });
    const envs = await fileService.getEnvironments(principal, "app1");

    expect(readObjectStub.calls.count()).toEqual(3);

    expect(envs.environments).toEqual([]);
  });

  it("should get files successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.returnValues(
      ...objectTree,
      { object: "{}", type: "blob" },
      { object: "{}", type: "blob" },
      { object: "{}", type: "blob" },
      { object: "{}", type: "blob" },
      { object: "{}", type: "blob" },
      ...objectTree,
      { object: { parent: [] } },
      { object: { parent: [] } }
    );

    const draftPath = path.resolve(
      percyConfig.draftFolder,
      TEST_USER.repoFolder,
      TEST_USER.branchName
    );
    const draftAppsPath = path.resolve(draftPath, percyConfig.yamlAppsFolder);
    await fs.mkdirs(draftPath);
    await fs.writeFile(draftPath + "/Blockquote.md", "{}");
    await fs.mkdirs(draftAppsPath);
    await fs.writeFile(draftAppsPath + "/Test.md", "{}");
    await fs.mkdirs(draftAppsPath + "/app1");
    await fs.mkdirs(draftAppsPath + "/app2/nest");
    await fs.writeFile(draftAppsPath + "/test.txt", "text");
    await fs.writeFile(draftAppsPath + "/app1/app1-client.yaml", "{}");
    await fs.writeFile(draftAppsPath + "/app1/test.md", "draft");
    await fs.writeFile(draftAppsPath + "/app2/test.txt", "text");
    await fs.writeFile(draftAppsPath + "/app2/.percyrc", "{}");

    const result = await fileService.getFiles(principal);

    expect(result.canPullRequest).toBeFalsy();
    expect(result.canSyncMaster).toBeFalsy();
    expect(result.applications.sort()).toEqual(["app1", "app2", "app3"]);
    expect(_.sortBy(result.files, ["applicationName", "fileName"])).toEqual([
      {
        applicationName: "",
        fileName: "Blockquote.md",
        fileType: FileTypes.MD,
        modified: true,
        size: 2,
        oid: "777777"
      },
      {
        applicationName: "",
        fileName: "README.md",
        fileType: FileTypes.MD,
        modified: false,
        oid: "666666"
      },
      {
        applicationName: "app1",
        fileName: ".percyrc",
        fileType: FileTypes.PERCYRC,
        modified: false,
        oid: "bbbbbb"
      },
      {
        applicationName: "app1",
        fileName: "app1-client.yaml",
        fileType: FileTypes.YAML,
        size: 2,
        modified: true,
        oid: "111111"
      },
      {
        applicationName: "app1",
        fileName: "app1-server.yaml",
        fileType: FileTypes.YAML,
        modified: false,
        oid: "222222"
      },
      {
        applicationName: "app1",
        fileName: "environments.yml",
        fileType: FileTypes.YAML,
        modified: false,
        oid: "333333"
      },
      {
        applicationName: "app1",
        fileName: "test.md",
        fileType: FileTypes.MD,
        size: 5,
        modified: true,
        oid: "aaaaaa"
      },
      {
        applicationName: "app2",
        fileName: ".percyrc",
        fileType: FileTypes.PERCYRC,
        size: 2,
        modified: true
      },
      {
        applicationName: "app2",
        fileName: "app2-client.yaml",
        fileType: FileTypes.YAML,
        modified: false,
        oid: "444444"
      },
      {
        applicationName: "app2",
        fileName: "app2-server.yaml",
        fileType: FileTypes.YAML,
        modified: false,
        oid: "555555"
      },
      {
        applicationName: percyConfig.yamlAppsFolder,
        fileName: ".percyrc",
        fileType: FileTypes.PERCYRC,
        modified: false,
        oid: "888888"
      },
      {
        applicationName: percyConfig.yamlAppsFolder,
        fileName: "Test.md",
        fileType: FileTypes.MD,
        modified: true,
        size: 2,
        oid: "999999"
      },
    ]);
  });

  it("should get file content successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    const percyFileContent = JSON.stringify({ key: "value" });

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));

    readObjectStub.and.returnValues(
      {
        oid: "222333",
        type: "blob",
        object: utilService.convertTreeToYaml(originalConfig)
      },
      {
        oid: "222444",
        type: "blob",
        object: "test"
      },
      {
        oid: "222555",
        type: "blob",
        object: percyFileContent
      },
      {
        oid: "222666",
        type: "blob",
        object: "test"
      }
    );

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    draftConfig.environments.addChild(new TreeNode("prod"));

    const file1 = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };

    const file2 = {
      applicationName: "",
      fileName: "test.md",
      fileType: FileTypes.MD
    };

    const file3 = {
      applicationName: percyConfig.yamlAppsFolder,
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC
    };

    const file4 = {
      applicationName: "app1",
      fileName: "test.md",
      fileType: FileTypes.MD
    };

    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);
    await fs.mkdirs(pathFinder1.draftAppDir);
    await fs.writeFile(
      pathFinder1.draftFullFilePath,
      utilService.convertTreeToYaml(draftConfig)
    );

    const result1 = await fileService.getFileContent(principal, file1);

    expect(result1).toEqual({
      ...file1,
      oid: "222333",
      modified: true,
      originalConfig,
      draftConfig
    });

    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);
    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      "test modified"
    );

    const result2 = await fileService.getFileContent(principal, file2);

    expect(result2).toEqual({
      ...file2,
      oid: "222444",
      modified: true,
      originalContent: "test",
      draftContent: "test modified"
    });

    const pathFinder3 = new PathFinder(TEST_USER, file3, TEST_USER.branchName);
    await fs.mkdirs(pathFinder3.draftAppDir);
    await fs.writeFile(
      pathFinder3.draftFullFilePath,
      "test modified"
    );

    const result3 = await fileService.getFileContent(principal, file3);

    expect(result3).toEqual({
      ...file3,
      oid: "222555",
      originalContent: percyFileContent
    });

    const pathFinder4 = new PathFinder(TEST_USER, file4, TEST_USER.branchName);
    await fs.mkdirs(pathFinder4.draftAppDir);
    await fs.writeFile(
      pathFinder4.draftFullFilePath,
      "test modified"
    );

    const result4 = await fileService.getFileContent(principal, file4);

    expect(result4).toEqual({
      ...file4,
      oid: "222666",
      modified: true,
      originalContent: "test",
      draftContent: "test modified"
    });
  });

  it("should get file content and remove draft file if it's same", async () => {
    await fileService.accessRepo(TEST_USER);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));

    readObjectStub.and.returnValues(
      {
        oid: "222333",
        type: "blob",
        object: utilService.convertTreeToYaml(originalConfig)
      },
      {
        oid: "222444",
        type: "blob",
        object: "test"
      }
    );

    const file1 = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };

    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);
    await fs.mkdirs(pathFinder1.draftAppDir);
    await fs.writeFile(
      pathFinder1.draftFullFilePath,
      utilService.convertTreeToYaml(originalConfig)
    );

    const result1 = await fileService.getFileContent(principal, file1);

    expect(await fs.pathExists(pathFinder1.draftFullFilePath)).toBeFalsy();
    expect(result1).toEqual({
      ...file1,
      oid: "222333",
      modified: false,
      originalConfig,
      draftConfig: undefined
    });

    const file2 = {
      applicationName: "app1",
      fileName: "test.md",
      fileType: FileTypes.MD
    };

    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);
    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      "test"
    );

    const result2 = await fileService.getFileContent(principal, file2);

    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();
    expect(result2).toEqual({
      ...file2,
      oid: "222444",
      modified: false,
      originalContent: "test",
      draftContent: undefined
    });
  });

  it("should get file content without draft config successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));

    readObjectStub.and.returnValue({
      oid: "222333",
      type: "blob",
      object: utilService.convertTreeToYaml(originalConfig)
    });

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };

    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.remove(pathFinder.draftFullFilePath);

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({
      ...file,
      oid: "222333",
      modified: false,
      originalConfig
    });
  });

  it("should get file content without original config successfully", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.callFake(() => {
      throw new TreeOrBlobNotFoundError();
    });

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    draftConfig.environments.addChild(new TreeNode("prod"));

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };

    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(
      pathFinder.draftFullFilePath,
      utilService.convertTreeToYaml(draftConfig)
    );

    const result = await fileService.getFileContent(principal, file);

    expect(result).toEqual({ ...file, modified: true, draftConfig });
  });

  it("error expected if both original config and draft config missing for yaml file", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.callFake(() => {
      throw new TreeOrBlobNotFoundError();
    });

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };

    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.remove(pathFinder.draftFullFilePath);

    try {
      await fileService.getFileContent(principal, file);
      fail("error expected");
    } catch (err) {
      expect(/File (.*) does not exist/.test(err.message)).toBeTruthy();
    }
  });

  it("error expected if both original content and draft content missing for non-yaml file", async () => {
    await fileService.accessRepo(TEST_USER);

    readObjectStub.and.callFake(() => {
      throw new TreeOrBlobNotFoundError();
    });

    const file = {
      applicationName: "app1",
      fileName: "test.md",
      fileType: FileTypes.MD
    };

    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.remove(pathFinder.draftFullFilePath);

    try {
      await fileService.getFileContent(principal, file);
      fail("error expected");
    } catch (err) {
      expect(/File (.*) does not exist/.test(err.message)).toBeTruthy();
    }
  });

  it("should save draft file successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));

    const file1 = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML,
      draftConfig,
      modified: true,
      oid: "223344"
    };

    await fileService.saveDraft(principal, file1);

    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);

    const draftFile1 = await fs.readFile(pathFinder1.draftFullFilePath);
    expect(utilService.parseYamlConfig(draftFile1.toString())).toEqual(
      draftConfig
    );

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual({
      [pathFinder1.repoFilePath]: file1.oid
    });
    const metadataFile1 = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile1)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({ [pathFinder1.repoFilePath]: file1.oid });

    const percyFileContent = JSON.stringify({ key: "value" });

    const file2 = {
      applicationName: percyConfig.yamlAppsFolder,
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC,
      draftContent: percyFileContent,
      modified: true,
      oid: "223355"
    };

    await fileService.saveDraft(principal, file2);

    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    const draftFile2 = await fs.readFile(pathFinder2.draftFullFilePath);
    expect(draftFile2.toString()).toEqual(
      percyFileContent
    );
  });

  it("save draft file which is same as original file, draft file should be deleted", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      draftConfig: originalConfig,
      originalConfig,
      modified: false,
      oid: "223344"
    };

    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.mkdirs(pathFinder.repoAppDir);
    await fs.writeFile(
      pathFinder.fullFilePath,
      utilService.convertTreeToYaml(originalConfig)
    );
    await fs.writeFile(
      pathFinder.draftFullFilePath,
      utilService.convertTreeToYaml(originalConfig)
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder.repoFilePath]: file.oid }
        },
        version: "1.0"
      }
    };

    await fileService.saveDraft(principal, file);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("should delete draft-only file successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    readObjectStub.and.callFake(() => {
      throw new TreeOrBlobNotFoundError();
    });

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML
    };
    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(
      pathFinder.draftFullFilePath,
      utilService.convertTreeToYaml(new Configuration())
    );

    const result = await fileService.deleteFile(principal, file);

    // Should not be pulled
    expect(result).toBeFalsy();
    expect(fetchStub.calls.count()).toEqual(0);
    expect(removeStub.calls.count()).toEqual(0);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();
  });

  it("should delete both draft and original file successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    readObjectStub.and.callFake(() => {});

    commitStub.and.returnValue(newCommitOid);

    const file = {
      applicationName: "",
      fileName: "test.md",
      fileType: FileTypes.MD,
      oid: "223344"
    };
    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(
      pathFinder.draftFullFilePath,
      "test"
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder.repoFilePath]: file.oid }
        },
        version: "1.0"
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
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("should delete original-only file successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    readObjectStub.and.callFake(() => {});
    commitStub.and.returnValue(newCommitOid);

    const file = {
      applicationName: percyConfig.yamlAppsFolder,
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC,
      oid: "223344"
    };

    const result = await fileService.deleteFile(principal, file);

    // Should pushed to repo
    expect(result).toBeFalsy();
    expect(fetchStub.calls.count()).toEqual(1);
    expect(removeStub.calls.count()).toEqual(1);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("delete failed when push, should reset to last commit", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    readObjectStub.and.callFake(() => {});
    commitStub.and.returnValue(newCommitOid);
    pushStub.and.throwError("mock push error");

    const file = {
      applicationName: "app1",
      fileName: "config.yaml",
      fileType: FileTypes.YAML,
      oid: "223344"
    };
    const pathFinder = new PathFinder(TEST_USER, file, TEST_USER.branchName);
    await fs.mkdirs(pathFinder.draftAppDir);
    await fs.writeFile(
      pathFinder.draftFullFilePath,
      utilService.convertTreeToYaml(new Configuration())
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder.repoFilePath]: file.oid }
        },
        version: "1.0"
      }
    };
    try {
      await fileService.deleteFile(principal, file);
      fail("error expected");
    } catch (err) {
      expect(err.message.indexOf("mock push error")).toBeGreaterThan(-1);
      expect(fetchStub.calls.count()).toEqual(1);
      expect(removeStub.calls.count()).toEqual(1);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
      assertRemoteCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
        { [pathFinder.repoFilePath]: file.oid }
      );
    }
  });

  it("should commit changed files successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    readObjectStub.and.returnValues(...objectTree);
    commitStub.and.returnValue(newCommitOid);
    listFilesStub.and.returnValue(["a.txt"]);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "111111",
      draftConfig
    };
    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);

    const file2 = {
      applicationName: "",
      fileName: "README.md",
      fileType: FileTypes.MD,
      oid: "666666"
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      "test"
    );

    const percyFileContent = JSON.stringify({ key: "value" });

    const file3 = {
      applicationName: "app3",
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC,
      oid: "eeeeee",
      draftContent: percyFileContent
    };
    const pathFinder3 = new PathFinder(TEST_USER, file3, TEST_USER.branchName);

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: {
            [pathFinder1.repoFilePath]: file1.oid,
            [pathFinder3.repoFilePath]: file3.oid
          }
        },
        version: "1.0"
      }
    };
    const result = await fileService.commitFiles(
      principal,
      [file1, file2, file3],
      "test commit"
    );

    expect(result.length).toEqual(3);
    result.forEach(file => {
      expect(file.modified).toBeFalsy();
      if (file.oid === file1.oid) {
        expect(file.originalConfig).toEqual(draftConfig);
      } else if (file.oid === file2.oid) {
        expect(file.originalContent).toEqual("test");
      } else if (file.oid === file3.oid) {
        expect(file.originalContent).toEqual(percyFileContent);
      }
      expect(file.draftConfig).toBeUndefined();
      expect(file.draftContent).toBeUndefined();
    });

    expect(fetchStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(3);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([".git"]);
    expect(resetIndexStub.calls.count()).toEqual(2);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("force push should ignore confict files", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "changed-oid",
      draftConfig
    };
    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);

    const file2 = {
      applicationName: "app1",
      fileName: "app1-server.yaml",
      fileType: FileTypes.YAML
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      utilService.convertTreeToYaml(draftConfig)
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder1.repoFilePath]: file1.oid }
        },
        version: "1.0"
      }
    };
    const result = await fileService.commitFiles(
      principal,
      [file1, file2],
      "test commit",
      true
    );

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
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([".git"]);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("error expected when conflict files exist", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));
    originalConfig.environments.addChild(new TreeNode("prod"));

    const originalConfigObj = {
      object: utilService.convertTreeToYaml(originalConfig),
      type: "blob"
    };

    readObjectStub.and.returnValues(
      ...objectTree,
      originalConfigObj,
      { object: "test original", type: "blob" }
    );
    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "changed-oid",
      draftConfig
    };
    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);

    const file2 = {
      applicationName: "app1",
      fileName: "test.md",
      fileType: FileTypes.MD
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      "test changed"
    );

    try {
      await fileService.commitFiles(principal, [file1, file2], "test commit");
      fail("err expected");
    } catch (err) {
      expect(
        err.message.indexOf(
          "The following file(s) are already changed in the repository"
        )
      ).toBeGreaterThan(-1);

      expect(err.data.length).toEqual(2);
      err.data.forEach(file => {
        if (file.fileType === FileTypes.YAML) {
          expect(file.draftConfig).toEqual(draftConfig);
          expect(file.originalConfig).toEqual(originalConfig);
        } else {
          expect(file.draftContent).toEqual("test changed");
          expect(file.originalContent).toEqual("test original");
        }
      });
      expect(fetchStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(0);
      expect(commitStub.calls.count()).toEqual(0);
      expect(pushStub.calls.count()).toEqual(0);

      // Head/Remote ref should not be updated
      assertHeadCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
      assertRemoteCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([
        ".git"
      ]);

      // Draft file should not be deleted
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should be updated
      expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
        { [pathFinder1.repoFilePath]: file1.oid }
      );
      const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
      expect(
        (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
      ).toEqual({ [pathFinder1.repoFilePath]: file1.oid });
    }
  });

  it("commit changes failed when push, should reset to last commit", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    commitStub.and.returnValue(newCommitOid);
    pushStub.and.throwError("mock push error");

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "changed-oid",
      draftConfig
    };
    const pathFinder1 = new PathFinder(TEST_USER, file1, TEST_USER.branchName);

    const file2 = {
      applicationName: percyConfig.yamlAppsFolder,
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);
    const percyFileContent = JSON.stringify({ key: "value changed" });

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      percyFileContent
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder1.repoFilePath]: file1.oid }
        },
        version: "1.0"
      }
    };
    try {
      await fileService.commitFiles(
        principal,
        [file1, file2],
        "test commit",
        true
      );
      fail("error expected");
    } catch (err) {
      expect(err.message.indexOf("mock push error")).toBeGreaterThan(-1);

      expect(fetchStub.calls.count()).toEqual(1);
      expect(addStub.calls.count()).toEqual(2);
      expect(commitStub.calls.count()).toEqual(1);
      expect(pushStub.calls.count()).toEqual(1);

      // Head/Remote ref should be reset to last commit
      assertHeadCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
      assertRemoteCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);

      // Repo dir should be clean (only have .git subfolder)
      expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([
        ".git"
      ]);

      // Draft file should still exists
      expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeTruthy();

      // Commit base SHA should not be cleared
      expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
        { [pathFinder1.repoFilePath]: file1.oid }
      );
    }
  });

  it("should resolve conflicts successfully", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));
    originalConfig.environments.addChild(new TreeNode("prod"));

    // changed file
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "changed-oid",
      draftConfig,
      originalConfig
    };

    // unchanged file
    const file2 = {
      applicationName: "app1",
      fileName: "app1-server.yaml",
      fileType: FileTypes.YAML,
      oid: "222222",
      draftConfig: originalConfig,
      originalConfig
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      utilService.convertTreeToYaml(draftConfig)
    );

    // changed file
    const file3 = {
      applicationName: "app1",
      fileName: "test.md",
      fileType: FileTypes.MD,
      oid: "changed-oid2",
      draftContent: "draft",
      originalContent: "original"
    };

    const percyFileContent = JSON.stringify({ key: "value" });

    // unchanged file
    const file4 = {
      applicationName: percyConfig.yamlAppsFolder,
      fileName: ".percyrc",
      fileType: FileTypes.PERCYRC,
      oid: "888888",
      draftContent: percyFileContent,
      originalContent: percyFileContent
    };
    const pathFinder4 = new PathFinder(TEST_USER, file4, TEST_USER.branchName);

    await fs.mkdirs(pathFinder4.draftAppDir);
    await fs.writeFile(
      pathFinder4.draftFullFilePath,
      JSON.stringify({ key: "value changed" })
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: {
            [pathFinder2.repoFilePath]: file2.oid,
            [pathFinder4.repoFilePath]: file4.oid
          }
        },
        version: "1.0"
      }
    };
    const result = await fileService.resovelConflicts(
      principal,
      [file1, file2, file3, file4],
      "test commit"
    );

    expect(result.length).toEqual(4);
    expect(result[0].modified).toBeFalsy();
    expect(result[1].modified).toBeFalsy();
    expect(result[2].modified).toBeFalsy();
    expect(result[3].modified).toBeFalsy();
    expect(result[0].originalConfig).toEqual(draftConfig);
    expect(result[1].originalContent).toEqual("draft");
    expect(result[2].originalContent).toEqual(percyFileContent);
    expect(result[3].originalConfig).toEqual(originalConfig);

    expect(fetchStub.calls.count()).toEqual(1);
    expect(addStub.calls.count()).toEqual(2);
    expect(commitStub.calls.count()).toEqual(1);
    expect(pushStub.calls.count()).toEqual(1);

    // Head/Remote ref should be updated
    assertHeadCommit(TEST_USER.branchName, newCommitOid);
    assertRemoteCommit(TEST_USER.branchName, newCommitOid);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([".git"]);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();
    expect(await fs.pathExists(pathFinder4.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });

  it("should resolve conflicts successfully, all files are not modified", async () => {
    await fileService.accessRepo(TEST_USER);
    await fileService.checkoutBranch(principal, "switch", TEST_USER.branchName);

    commitStub.and.returnValue(newCommitOid);

    const draftConfig = new Configuration();
    draftConfig.environments.addChild(new TreeNode("dev"));
    draftConfig.environments.addChild(new TreeNode("qat"));

    const originalConfig = new Configuration();
    originalConfig.environments.addChild(new TreeNode("dev"));
    originalConfig.environments.addChild(new TreeNode("qat"));
    originalConfig.environments.addChild(new TreeNode("prod"));

    // unchanged file
    const file1 = {
      applicationName: "app1",
      fileName: "app1-client.yaml",
      fileType: FileTypes.YAML,
      oid: "changed-oid",
      draftConfig: originalConfig,
      originalConfig
    };

    // unchanged file
    const file2 = {
      applicationName: "app1",
      fileName: "app1-server.yaml",
      fileType: FileTypes.YAML,
      oid: "222222",
      draftConfig: originalConfig,
      originalConfig
    };
    const pathFinder2 = new PathFinder(TEST_USER, file2, TEST_USER.branchName);

    await fs.mkdirs(pathFinder2.draftAppDir);
    await fs.writeFile(
      pathFinder2.draftFullFilePath,
      utilService.convertTreeToYaml(draftConfig)
    );

    principal = {
      user: TEST_USER,
      repoMetadata: {
        ...TEST_USER,
        commitBaseSHA: {
          [TEST_USER.branchName]: { [pathFinder2.repoFilePath]: file2.oid }
        },
        version: "1.0"
      }
    };
    const result = await fileService.resovelConflicts(
      principal,
      [file1, file2],
      "test commit"
    );

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
    assertHeadCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);
    assertRemoteCommit(TEST_USER.branchName, commits[TEST_USER.branchName]);

    // Repo dir should be clean (only have .git subfolder)
    expect(await fs.readdir(PathFinder.getRepoDir(TEST_USER))).toEqual([".git"]);

    // Draft file should be deleted
    expect(await fs.pathExists(pathFinder2.draftFullFilePath)).toBeFalsy();

    // Commit base SHA should be cleared
    expect(principal.repoMetadata.commitBaseSHA[TEST_USER.branchName]).toEqual(
      {}
    );
    const metadataFile = utilService.getMetadataPath(TEST_USER.repoFolder);
    expect(
      (await fs.readJson(metadataFile)).commitBaseSHA[TEST_USER.branchName]
    ).toEqual({});
  });
});
