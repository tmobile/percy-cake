import { Injectable } from '@angular/core';
import * as path from 'path';
import * as HttpErrors from 'http-errors';
import { TreeDescription, CommitDescription } from 'isomorphic-git';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { User, Authenticate, Principal, RepoMetadata } from 'models/auth';
import { TreeNode } from 'models/tree-node';
import { ConfigFile } from 'models/config-file';
import { UtilService, git, FS } from './util.service';
import { MaintenanceService } from './maintenance.service';


export class PathFinder {

  public readonly repoDir: string;
  public readonly repoAppDir: string;
  public readonly repoFilePath: string;
  public readonly fullFilePath: string;

  public readonly draftDir: string;
  public readonly draftAppDir: string;
  public readonly draftFullFilePath: string;

  static getRepoDir(user: User) {
    return path.resolve(percyConfig.reposFolder, user.repoFolder);
  }

  constructor(public user: User, public file: ConfigFile, branch: string) {
    this.repoDir = PathFinder.getRepoDir(this.user);
    this.repoAppDir = path.resolve(this.repoDir, percyConfig.yamlAppsFolder, this.file.applicationName);
    this.repoFilePath = path.join(percyConfig.yamlAppsFolder, this.file.applicationName, this.file.fileName);
    this.fullFilePath = path.resolve(this.repoAppDir, this.file.fileName);

    this.draftDir = path.resolve(percyConfig.draftFolder, this.user.repoFolder, branch);
    this.draftAppDir = path.resolve(this.draftDir, percyConfig.yamlAppsFolder, this.file.applicationName);
    this.draftFullFilePath = path.resolve(this.draftAppDir, this.file.fileName);
  }
}

/**
 * This service provides the methods around the file management API endpoints
 */
@Injectable({ providedIn: 'root' })
export class FileManagementService {

  /**
   * initializes the service
   * @param utilService the util service
   * @param maintenanceService the maintenance service
   */
  constructor(private utilService: UtilService,
    private maintenanceService: MaintenanceService) { }

  /**
   * access the repository and receives the security token to be used in subsequent requests
   * @param auth the authenticate request
   * @param repo the repo
   */
  async accessRepo(auth: Authenticate) {
    const fs = await this.utilService.getBrowserFS();

    const { repoName, repoFolder } = this.utilService.getRepoFolder(auth);

    const repoDir = path.resolve(percyConfig.reposFolder, repoFolder);
    const repoMetadataFile = this.utilService.getMetadataPath(repoFolder);

    let existingRepoMetadata: RepoMetadata;
    if (await fs.pathExists(repoDir)) {
      // Check repo metadata file
      if (await fs.pathExists(repoMetadataFile)) {
        try {
          existingRepoMetadata = await fs.readJson(repoMetadataFile);
          if (existingRepoMetadata.version !== percyConfig.repoMetadataVersion) {
            existingRepoMetadata = null;
          }
        } catch (err) {
          console.warn(`${repoDir} exists but medata is broken, will clone again`);
        }
      } else {
        console.warn(`${repoDir} exists but metadata missing, will clone again`);
      }

      if (!existingRepoMetadata) {
        await fs.remove(repoDir);
      }
    }

    const branchName = 'master';

    try {
      if (!existingRepoMetadata) {
        try {
          // Clone repo. We do a noCheckout action, for performance reason (less files, less I/O).
          // The repo will only contain the '.git' folder, nothing else.
          // The file content will directly be read from pack files in '.git', by using git.readObject.
          await git.clone({
            url: auth.repositoryUrl,
            username: auth.username,
            password: auth.password,
            dir: repoDir,
            ref: branchName,
            depth: 1, // Shallow clone repo with --depth as 1
            noCheckout: true, // No checkout
            corsProxy: percyConfig.corsProxy,
          });
        } catch (err) {
          // If error while clone remove the repo dir
          await fs.remove(repoDir);
          throw err;
        }
      } else {
        // Fetch new commits for all branches
        await this.fetchAllBranches(auth, repoDir);
      }
    } catch (error) {
      throw this.utilService.convertGitError(error);
    }

    const draftFolder = path.resolve(percyConfig.draftFolder, repoFolder);
    await fs.ensureDir(draftFolder);

    await this.maintenanceService.addUserName(auth.username);

    // In case of pull, remember the existing commit base SHAs
    const commitBaseSHA = existingRepoMetadata ? existingRepoMetadata.commitBaseSHA || {} : {};

    // Create token payload
    const tokenPayload: any = {
      username: auth.username,
      iat: Date.now()
    };

    const user: User = {
      ...auth,
      branchName,
      password: this.utilService.encrypt(auth.password),
      repoName,
      repoFolder,
      token: this.utilService.encrypt(JSON.stringify(tokenPayload))
    };

    // Save user to repo metadata locally
    await fs.outputJson(repoMetadataFile, { ...user, commitBaseSHA, version: percyConfig.repoMetadataVersion });

    return user;
  }

  /**
   * Fetch new commits for all branches.
   *
   * Similar as clone, we never checkout, just fetch from remote repo.
   *
   * @param auth the authenticate
   * @param repoDir the repo dir
   */
  private async fetchAllBranches(auth: Authenticate, repoDir: string) {
    await this.fetchBranch(auth, repoDir, 'master', false);
  }

  /**
   * Fetch branch's new commit.
   *
   * Similar as clone, we never checkout, just fetch from remote repo.
   *
   * @param auth the authenticate
   * @param repoDir the repo dir
   * @param branch the branch to refresh
   * @param singleBranch the flag indicates whether to fetch given branch only, or to fetch all branches
   * @returns new commit and flag indicates whether branch is changed
   */
  private async fetchBranch(auth: Authenticate, repoDir: string, branch: string, singleBranch: boolean) {

    const lastCommit = await this.getRemoteCommit(repoDir, branch);

    // Fetch new commit
    try {
      await git.fetch({
        username: auth.username,
        password: auth.password,
        dir: repoDir,
        ref: branch,
        singleBranch,
        depth: 1,
        corsProxy: percyConfig.corsProxy
      });
    } catch (err) {
      if (err.code === git.E.ResolveRefError) {
        console.warn(`ResolveRefError when fetching ${branch}, maybe remote branch has been deleted`);
        return { pulledCommit: lastCommit, changed: false };
      }
      throw err;
    }

    const pulledCommit = await this.syncHeadCommit(repoDir, branch);

    return { pulledCommit, changed: lastCommit !== pulledCommit };
  }

  /**
   * list branch names (both local and remote).
   *
   * @param user the logged in user pricipal
   * @returns array of branches
   */
  async listBranches(principal: Principal) {
    const { user } = await this.maintenanceService.checkSessionTimeout(principal);
    const repoDir = PathFinder.getRepoDir(user);

    const localBranches = await git.listBranches({
      dir: repoDir,
    });
    const remoteBranches = await git.listBranches({
      dir: repoDir,
      remote: 'origin',
    });

    const filterBranches = (branches: string[]) => branches.filter(b => b !== 'HEAD' && percyConfig.lockedBranches.indexOf(b) < 0);
    return _.union(filterBranches(localBranches), filterBranches(remoteBranches)).sort();
  }

  /**
   * Checkout branch.
   *
   * @param user the logged in user pricipal
   * @param type the type, either 'switch' or 'create'
   * @param branch the branch to swtich to
   */
  async checkoutBranch(principal: Principal, type: string, branch: string) {
    const { user } = await this.maintenanceService.checkSessionTimeout(principal);

    const fs = await this.utilService.getBrowserFS();
    const repoDir = PathFinder.getRepoDir(user);

    if (type === 'create') {
      // Refresh all branches
      await this.fetchAllBranches(user, repoDir);
      const remoteBranches = await git.listBranches({
        dir: repoDir,
        remote: 'origin',
      });
      if (remoteBranches.indexOf(branch) >= 0) {
        throw new Error(`${branch} already exists`);
      }

      // when create new branch, based off on 'master'
      const commit = await this.syncHeadCommit(repoDir, 'master', branch);
      const previsouBranch = await git.currentBranch({ dir: repoDir });
      await this.writeHeadRef(repoDir, branch);

      try {
        await this.doPush(fs, user, repoDir, branch, commit, `Create Branch ${branch}`, async () => { });
      } catch (err) {
        await this.writeHeadRef(repoDir, previsouBranch);
        await git.deleteRef({
          dir: repoDir,
          ref: `refs/heads/${branch}`,
        });
        throw err;
      }
    } else {
      await this.syncHeadCommit(repoDir, branch);
      await this.writeHeadRef(repoDir, branch);
    }

    await git.config({ dir: repoDir, path: `branch.${branch}.merge`, value: `refs/heads/${branch}` });
    await git.config({ dir: repoDir, path: `branch.${branch}.remote`, value: 'origin' });

    const { repoFolder } = this.utilService.getRepoFolder(user);

    const repoMetadataFile = this.utilService.getMetadataPath(repoFolder);
    const repoMetadata: RepoMetadata = await fs.readJson(repoMetadataFile);
    repoMetadata.branchName = branch;

    await fs.outputJson(repoMetadataFile, repoMetadata);
  }

  /**
   * Sync head commit oid with remote commit oid.
   * @param repoDir the repo dir
   * @param src the source remote branch
   * @param target the target branch to update its head
   * @returns the remote commit oid
   */
  private async syncHeadCommit(repoDir: string, src: string, target?: string) {

    const commitOid = await this.getRemoteCommit(repoDir, src);

    await this.writeHeadCommit(repoDir, target || src, commitOid);

    return commitOid;
  }

  /**
   * Write head reference in .git/HEAD to given branch.
   * @param repoDir the repo dir
   * @param branch the branch name
   */
  private async writeHeadRef(repoDir: string, branch: string) {
    await git.writeRef({
      dir: repoDir,
      ref: 'HEAD',
      value: `refs/heads/${branch}`,
      symbolic: true,
      force: true,
    });
  }

  /**
   * Write head commit oid in .git/refs/heads/{branch}.
   * @param repoDir the repo dir
   * @param branch the branch name
   * @param commitOid the commit oid
   */
  private async writeHeadCommit(repoDir: string, branch: string, commitOid: string) {

    await git.writeRef({
      dir: repoDir,
      ref: `refs/heads/${branch}`,
      value: commitOid,
      force: true,
    });
  }

  /**
   * Write remote commit oid in .git/refs/remotes/origin/{branch}.
   * @param repoDir the repo dir
   * @param branch the branch name
   * @param commitOid the commit oid
   */
  private async writeRemoteCommit(repoDir: string, branch: string, commitOid: string) {

    await git.writeRef({
      dir: repoDir,
      ref: `refs/remotes/origin/${branch}`,
      value: commitOid,
      force: true,
    });
  }

  /**
   * Get remote commit oid of branch.
   *
   * @param repoDir the repo dir
   * @param branch the branch name
   * @returns remote commit oid of branch
   */
  private async getRemoteCommit(repoDir: string, branch: string) {
    return await git.resolveRef({
      dir: repoDir,
      ref: `refs/remotes/origin/${branch}`,
    });
  }

  /**
   * refresh files for a particular repository.
   *
   * @param principal the logged in user principal
   */
  async refresh(principal: Principal) {
    const { user } = await this.maintenanceService.checkSessionTimeout(principal);

    const repoDir = PathFinder.getRepoDir(user);
    const lastCommit = await this.getRemoteCommit(repoDir, user.branchName);

    await this.fetchAllBranches(user, repoDir);

    const pulledCommit = await this.syncHeadCommit(repoDir, user.branchName);

    return { pulledCommit, changed: lastCommit !== pulledCommit };
  }

  /**
   * get the app environments and percy config
   * @param user the logged in user
   * @param applicationName the app name
   * @returns app environments and percy config
   */
  async getEnvironments(principal: Principal, applicationName: string) {
    const file = {
      fileName: percyConfig.environmentsFile,
      applicationName
    };

    // Load environments.yaml
    const getEnvs = async () => {
      let envFile: ConfigFile;
      try {
        envFile = await this.getFileContent(principal, file);
      } catch (err) {
        if (err instanceof HttpErrors.HttpError && err.statusCode === 404) {
          console.warn(`${applicationName} environments file does not exist`);
          return [];
        } else {
          throw err;
        }
      }

      const config = envFile.draftConfig || envFile.originalConfig;
      return _.map(_.get(config.environments, 'children', <TreeNode[]>[]), child => child.key);
    };

    const result = await Promise.all([
      getEnvs(),
      this.loadAppPercyConfig(principal.user, applicationName),
    ]);

    return { environments: result[0], appPercyConfig: result[1] };
  }

  /**
   * Loads application's specific percy config.
   *
   * @param user the logged in user
   * @param applicationName the application name
   */
  private async loadAppPercyConfig(user: User, applicationName: string) {

    const dir = PathFinder.getRepoDir(user);
    const commitOid = await this.getRemoteCommit(dir, user.branchName);

    // Load .percyrc for the app
    const readPercyrc = async (filepath: string) => {
      const { content } = await this.readRepoFile(dir, commitOid, filepath);
      return content ? JSON.parse(content) : {};
    };

    const result = await Promise.all([
      readPercyrc(path.join(percyConfig.yamlAppsFolder, '.percyrc')),
      readPercyrc(path.join(percyConfig.yamlAppsFolder, applicationName, '.percyrc')),
    ]);

    // Merge percyrcs
    return _.assign({}, ...result);
  }

  /**
   * Read from git object directly to find yaml files in repo.
   * This method will not read file content, it just traverse the object tree.
   */
  private async findRepoYamlFiles(dir: string, branch: string, result: { [key: string]: ConfigFile[] } = {},
    depth: number = 0, oid?: string, app?: string) {
    if (depth === 0) {
      const remoteOid = await this.getRemoteCommit(dir, branch);
      const { object: tree } = await git.readObject({ dir, oid: remoteOid });
      oid = (<CommitDescription>tree).tree;
    }

    const { object } = await git.readObject({ dir, oid });

    for (const entry of (<TreeDescription>object).entries) {
      if (depth === 0) {
        if (entry.path === percyConfig.yamlAppsFolder && entry.type === 'tree') {
          await this.findRepoYamlFiles(dir, branch, result, 1, entry.oid);
        }
      } else if (depth === 1) {
        if (entry.type === 'tree') {
          result[entry.path] = [];
          await this.findRepoYamlFiles(dir, branch, result, 2, entry.oid, entry.path);
        }
      } else {
        if (entry.type === 'blob') {
          const ext = path.extname(entry.path).toLowerCase();
          if (ext === '.yaml' || ext === '.yml') {
            const file: ConfigFile = {
              applicationName: app,
              fileName: entry.path,
              oid: entry.oid,
            };
            result[app].push(file);
          }
        }
      }
    }
    return result;
  }

  /**
   * get files for a particular repository.
   *
   * Note: this method never loads file content for performance reason
   *
   * @param user the logged in user
   */
  async getFiles(principal: Principal) {
    const fs = await this.utilService.getBrowserFS();

    const { user } = await this.maintenanceService.checkSessionTimeout(principal);
    const repoDir = PathFinder.getRepoDir(user);

    const [draft, repoFiles] = await Promise.all([
      this.findDraftFiles(fs, user.repoFolder, user.branchName),
      this.findRepoYamlFiles(repoDir, user.branchName),
    ]);

    _.forEach(_.keys(repoFiles), app => {
      if (draft.applications.indexOf(app) === -1) {
        draft.applications.push(app);
      }
      _.forEach(repoFiles[app], repoFile => {
        const draftFile = _.find(draft.files, f => f.applicationName === repoFile.applicationName && f.fileName === repoFile.fileName);
        if (!draftFile) {
          repoFile.modified = false;
          draft.files.push(repoFile);
        } else {
          _.assign(draftFile, repoFile);
        }
      });
    });


    return draft;
  }

  /**
   * Find draft files.
   *
   * Note: this method never loads file content for performance reason
   *
   * @param fs the FS
   * @param repoFolder the repo folder name
   * @param branchName the branch name
   */
  private async findDraftFiles(fs: FS, repoFolder: string, branchName: string) {

    const files: ConfigFile[] = [];
    const applications: string[] = [];
    const repoPath = path.resolve(percyConfig.draftFolder, repoFolder);
    const appsPath = path.resolve(repoPath, branchName, percyConfig.yamlAppsFolder);
    if (await fs.pathExists(appsPath)) {
      const apps = await fs.readdir(appsPath);

      await Promise.all(apps.map(async (applicationName) => {
        const appPath = path.resolve(appsPath, applicationName);
        if (!(await fs.stat(appPath)).isDirectory()) {
          return;
        }
        applications.push(applicationName);
        const appFiles = await fs.readdir(appPath);
        await Promise.all(appFiles.map(async (fileName) => {
          const stat = await fs.stat(path.resolve(appPath, fileName));
          if (!stat.isFile()) {
            return;
          }
          const ext = path.extname(fileName).toLowerCase();
          if (ext === '.yaml' || ext === '.yml') {
            const file: ConfigFile = {
              applicationName,
              fileName,
              size: stat.size,
              modified: true // For draft files, we simply assume they're modified
            };
            files.push(file);
          }
        }));
      }));
    }

    return { files, applications };
  }

  /**
   * get file content of provided file path
   * @param user the logged in user
   * @param file the file to get its draft and original content
   */
  async getFileContent(principal: Principal, file: ConfigFile): Promise<ConfigFile> {
    const fs = await this.utilService.getBrowserFS();
    const { user, repoMetadata } = await this.maintenanceService.checkSessionTimeout(principal);

    const repoDir = PathFinder.getRepoDir(user);
    const branchName = user.branchName;
    const pathFinder = new PathFinder(user, file, branchName);

    const commitOid = await this.getRemoteCommit(repoDir, branchName);
    const { content, oid } = await this.readRepoFile(repoDir, commitOid, pathFinder.repoFilePath);

    if (content) {
      file.oid = oid;
      file.originalConfig = this.utilService.parseYamlConfig(content);
    }

    if (await fs.pathExists(pathFinder.draftFullFilePath)) {
      const draftContent = await fs.readFile(pathFinder.draftFullFilePath);
      file.draftConfig = this.utilService.parseYamlConfig(draftContent.toString());
    }

    if (!file.originalConfig && !file.draftConfig) {
      throw new HttpErrors.NotFound(`File '${file.applicationName}/${file.fileName}' does not exist`);
    }

    file.modified = file.draftConfig ? !_.isEqual(file.originalConfig, file.draftConfig) : false;

    if (file.draftConfig && !file.modified) {
      // Remove draft file
      await fs.remove(pathFinder.draftFullFilePath);
      // Clear commit base SHA
      await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' }, branchName);
      file.draftConfig = undefined;
    }

    return file;
  }

  /**
   * Save commit base SHA (which is file's oid).
   */
  private async saveCommitBaseSHA(fs: FS, repoMetadata: RepoMetadata, newBaseSHAs: { [filepath: string]: string }, branch: string) {
    let anyChange = false;

    let commitBaseSHA = repoMetadata.commitBaseSHA[branch];
    if (!commitBaseSHA) {
      commitBaseSHA = repoMetadata.commitBaseSHA[branch] = {};
      anyChange = true;
    }

    _.each(newBaseSHAs, (newBaseSHA, filepath) => {
      if (!newBaseSHA && commitBaseSHA[filepath]) {
        delete commitBaseSHA[filepath];
        anyChange = true;
      } else if (newBaseSHA && commitBaseSHA[filepath] !== newBaseSHA) {
        commitBaseSHA[filepath] = newBaseSHA;
        anyChange = true;
      }
    });

    if (anyChange) {
      // Only save when there is change
      const metadataFile = this.utilService.getMetadataPath(repoMetadata.repoFolder);
      await fs.outputJson(metadataFile, repoMetadata);
    }
  }

  /**
   * Save draft file.
   *
   * Note this method is also reponsible to clean draft data in case file is not modified.
   *
   * @param user the logged in user
   * @param file the draft file to save
   */
  async saveDraft(principal: Principal, file: ConfigFile) {
    const fs = await this.utilService.getBrowserFS();
    const { user, repoMetadata } = await this.maintenanceService.checkSessionTimeout(principal);

    const branchName = user.branchName;
    const pathFinder = new PathFinder(user, file, branchName);

    if (!file.modified) {
      // Not modified, don't need draft file
      const draftFileExists = await fs.pathExists(pathFinder.draftFullFilePath);
      if (draftFileExists) {
        console.warn(`Draft file '${file.applicationName}/${file.fileName}' found to have same content as repo, will be deleted`);
        await fs.remove(pathFinder.draftFullFilePath);
      }
      // Clear commit base SHA
      await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' }, branchName);
    } else {
      // Save draft
      await fs.ensureDir(pathFinder.draftAppDir);

      // Save the draft config
      await fs.writeFile(pathFinder.draftFullFilePath, this.utilService.convertTreeToYaml(file.draftConfig));

      if ((!repoMetadata.commitBaseSHA[branchName] || !repoMetadata.commitBaseSHA[branchName][pathFinder.repoFilePath]) && file.oid) {
        // Save draft file's commit base SHA if not saved yet
        await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: file.oid }, branchName);
      }
    }

    return file;
  }

  /**
   * Read file content from repo.
   * @param repoDir the repo dir
   * @param commitOid the commit oid
   * @param filepath the file path
   * @returns file content and file oid; null value will be returned if file does not exist
   */
  private async readRepoFile(repoDir: string, commitOid: string, filepath: string) {
    try {
      const { object, oid, type } = await git.readObject({
        dir: repoDir,
        oid: commitOid,
        filepath,
        format: 'parsed',
        encoding: 'utf8'
      });
      return { content: type === 'blob' ? object.toString() : null, oid };
    } catch (err) {
      if (err.code === git.E.TreeOrBlobNotFoundError) {
        return { content: null, oid: null };
      }
      throw err;
    }
  }

  /**
   * Check if file exists in repo.
   * @param repoDir the repo dir
   * @param commitOid the commit oid
   * @param filepath the file path
   * @returns true if repo file exists, false otherwise
   */
  private async isRepoFileExists(repoDir: string, commitOid: string, filepath: string) {
    try {
      await git.readObject({
        dir: repoDir,
        oid: commitOid,
        filepath,
        format: 'deflated'
      });
      return true;
    } catch (err) {
      if (err.code === git.E.TreeOrBlobNotFoundError) {
        return false;
      }
      throw err;
    }
  }

  /**
   * deletes the file within the given location from the repository
   * @param auth the logged in user
   * @param file the file to delete
   */
  async deleteFile(principal: Principal, file: ConfigFile) {
    const fs = await this.utilService.getBrowserFS();
    const { user, repoMetadata } = await this.maintenanceService.checkSessionTimeout(principal);

    const repoDir = PathFinder.getRepoDir(user);
    const branchName = user.branchName;
    const pathFinder = new PathFinder(user, file, branchName);

    let gitPulled = false;

    const commitOid = await this.getRemoteCommit(repoDir, branchName);
    if (await this.isRepoFileExists(pathFinder.repoDir, commitOid, pathFinder.repoFilePath)) {
      const { pulledCommit, changed } = await this.fetchBranch(user, repoDir, branchName, true);
      gitPulled = changed;

      // Check whether exists again after pull
      if (await this.isRepoFileExists(pathFinder.repoDir, pulledCommit, pathFinder.repoFilePath)) {
        // Do push
        await this.doPush(fs, user, repoDir, branchName, pulledCommit, 'Percy delete',
          () => git.remove({
            dir: repoDir,
            filepath: pathFinder.repoFilePath
          })
        );
      }
    }

    // Also delete draft file if any
    if (await fs.pathExists(pathFinder.draftFullFilePath)) {
      await fs.remove(pathFinder.draftFullFilePath);
    }
    // Also delete commit base SHA if any
    await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' }, branchName);

    return gitPulled;
  }

  /**
   * Do push. Will rollback to last commit if any error.
   */
  private async doPush(fs: FS, user: User, dir: string, branch: string, lastCommit: string, message: string,
    commitAction: () => Promise<any>, forcePush = false) {

    await this.resetIndexes(fs, dir, branch);

    let commitOid: string;
    try {
      await commitAction();

      commitOid = await git.commit({
        dir,
        message,
        author: {
          name: user.username,
          email: user.username
        }
      });

      await git.push({
        dir,
        ref: branch,
        username: user.username,
        password: user.password,
        corsProxy: percyConfig.corsProxy,
        force: forcePush
      });
    } catch (err) {
      // Rollback to last commit
      await this.writeHeadCommit(dir, branch, lastCommit);
      await this.resetIndexes(fs, dir, user.branchName);
      throw err;
    }

    // Weird, isogit does't update the remote commit oid after push
    await this.writeRemoteCommit(dir, branch, commitOid);
    await this.writeHeadCommit(dir, branch, commitOid);
    await this.resetIndexes(fs, dir, branch);
  }

  /**
   * Ensure Index status identical to HEAD status.
   */
  private async resetIndexes(fs: FS, dir: string, branch: string) {

    // Remove any workdir files
    const workfiles = await fs.readdir(dir);
    for (const file of workfiles) {
      if (file !== '.git') {
        await fs.remove(path.resolve(dir, file));
      }
    }

    await fs.remove(path.resolve(dir, '.git', 'index'));

    // Ensure Index status identical to HEAD status
    const matrix = await git.statusMatrix({ dir, ref: branch, pattern: '**' });
    for (const row of matrix) {
      if (row[3] !== 1) {
        // Index status not identical to head status, reset index
        // See https://isomorphic-git.org/docs/en/statusMatrix
        await git.resetIndex({ dir, filepath: row[0], ref: branch });
      }
    }
  }

  /**
   * Commits the files
   * @param auth the logged in user
   * @param configFiles the config files to commit
   * @param message the commit message
   * @param forcePush the flag indicates whether to force push
   */
  async commitFiles(principal: Principal, configFiles: ConfigFile[], message: string, forcePush = false) {
    const fs = await this.utilService.getBrowserFS();
    const { user, repoMetadata } = await this.maintenanceService.checkSessionTimeout(principal);

    const repoDir = PathFinder.getRepoDir(user);
    const branchName = user.branchName;

    const { pulledCommit } = await this.fetchBranch(user, repoDir, branchName, true);

    let newRepoFiles: ConfigFile[];
    if (!forcePush) {
      newRepoFiles = _.reduce(await this.findRepoYamlFiles(repoDir, branchName), (r, v) => r.concat(v), []);
    }

    // Do optimistic check
    const conflictFiles: ConfigFile[] = [];
    let commitBaseSHA = _.cloneDeep(repoMetadata.commitBaseSHA[branchName] || {});
    await Promise.all(configFiles.map(async (file) => {

      const pathFinder = new PathFinder(user, file, branchName);

      if (!file.draftConfig) {
        const content = await fs.readFile(pathFinder.draftFullFilePath);
        file.draftConfig = this.utilService.parseYamlConfig(content.toString());
      }

      if (!forcePush) {
        const oldOid = commitBaseSHA[pathFinder.repoFilePath] || file.oid;
        if (oldOid) {
          // When commit added file, there is no oldOid
          // When commit edited file, assign it as base SHA
          commitBaseSHA[pathFinder.repoFilePath] = oldOid;
        }

        const newFile = _.find(newRepoFiles, f => f.applicationName === file.applicationName && f.fileName === file.fileName);
        const newOid = newFile ? newFile.oid : undefined;

        if ((!oldOid && newOid) || (oldOid && newOid && oldOid !== newOid)) { // Should conflict if found to be deleted?
          const { content } = await this.readRepoFile(repoDir, pulledCommit, pathFinder.repoFilePath);
          const originalConfig = this.utilService.parseYamlConfig(content);
          conflictFiles.push({
            ...file,
            originalConfig,
          });
        }
      }
    }));

    if (conflictFiles.length) {
      // Conflict happens, save the conflicted commit base SHA, then user will have 3 options:
      // 1. Use repo file to discard local draft changes (commit base SHA will be cleared)
      // 2. Force to push draft file (commit base SHA will be cleared upon successful push)
      // 3. None of the above, and try to commit again, conflict will happen again
      await this.saveCommitBaseSHA(fs, repoMetadata, commitBaseSHA, branchName);

      const names = conflictFiles.map((file) => `• ${file.applicationName}/${file.fileName}`).join('\n');
      const error = new HttpErrors.Conflict(`The following file(s) are already changed in the repository:\n${names}`);
      error.data = conflictFiles;
      throw error;
    }

    await this.doPush(fs, user, repoDir, branchName, pulledCommit, message,
      async () => {
        // Create folders at first
        const folders = [];
        _.each(configFiles, file => {
          const folderPath = path.resolve(repoDir, percyConfig.yamlAppsFolder, file.applicationName);
          if (!folders.includes(folderPath)) {
            folders.push(folderPath);
          }
        });
        for (const folder of folders) {
          await fs.ensureDir(folder);
        }

        await Promise.all(configFiles.map(async (file) => {
          const folderPath = path.resolve(repoDir, percyConfig.yamlAppsFolder, file.applicationName);
          const fullFilePath = path.resolve(folderPath, file.fileName);

          // Convert json to yaml
          await fs.writeFile(fullFilePath, this.utilService.convertTreeToYaml(file.draftConfig));

          file.size = (await fs.stat(fullFilePath)).size;
        }));

        for (const file of configFiles) {
          // Add file to index
          await git.add({
            dir: repoDir,
            filepath: path.join(percyConfig.yamlAppsFolder, file.applicationName, file.fileName)
          });
        }
      },
      forcePush
    );

    // Delete draft files
    commitBaseSHA = {};
    await Promise.all(configFiles.map(async (file) => {
      const pathFinder = new PathFinder(user, file, branchName);
      if (await fs.pathExists(pathFinder.draftFullFilePath)) {
        await fs.remove(pathFinder.draftFullFilePath);
      }
      file.modified = false;
      file.originalConfig = file.draftConfig;
      file.draftConfig = undefined;
      commitBaseSHA[pathFinder.repoFilePath] = '';
    }));

    // Clear commit base SHAs
    await this.saveCommitBaseSHA(fs, repoMetadata, commitBaseSHA, branchName);

    // Important Note:
    // This method does NOT return newest oid of files, the app will
    // redirect to dashboard and reload files, thus get the newest oid.
    // In future if the app behavior is changed (e.g no redirect to dashboard),
    // then this method need return the newest oid
    return configFiles;
  }

  /**
   * Resolve conflicts
   * @param auth the logged in user
   * @param configFiles the config files to commit
   * @param message the commit message
   */
  async resovelConflicts(principal: Principal, configFiles: ConfigFile[], message: string) {
    const modified: ConfigFile[] = [];
    let result: ConfigFile[] = [];

    await Promise.all(configFiles.map(async (file) => {
      file.modified = !_.isEqual(file.draftConfig, file.originalConfig);

      if (file.modified) {
        modified.push(file);
      } else {
        await this.saveDraft(principal, file); // This will remove draft file and clear commit base SHA
        result.push(file);
      }
    }));

    if (modified.length) {
      const committed = await this.commitFiles(principal, modified, message, true);
      result = _.concat(committed, result);
    }

    return result;
  }
}
