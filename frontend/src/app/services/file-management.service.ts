import { Injectable } from '@angular/core';
import * as path from 'path';
import * as boom from 'boom';
import * as ms from 'ms';
import * as AsyncLock from 'async-lock';
import { TreeDescription, CommitDescription } from 'isomorphic-git';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { User, Authenticate } from 'models/auth';
import { ConfigFile, Configuration } from 'models/config-file';
import { getGitFS, GIT, FSExtra } from './git-fs.service';
import { UtilService } from './util.service';
import { MaintenanceService } from './maintenance.service';

const lock = new AsyncLock();

class PathFinder {

  public readonly repoDir: string;
  public readonly repoAppDir: string;
  public readonly repoFilePath: string;
  public readonly fullFilePath: string;

  public readonly draftDir: string;
  public readonly draftAppDir: string;
  public readonly draftFullFilePath: string;

  constructor(public user:User, public file: ConfigFile) {
    this.repoDir = path.resolve(percyConfig.reposFolder, this.user.repoFolder);
    this.repoAppDir = path.resolve(this.repoDir, percyConfig.yamlAppsFolder, this.file.applicationName);
    this.repoFilePath = path.join(percyConfig.yamlAppsFolder, this.file.applicationName, this.file.fileName);
    this.fullFilePath = path.resolve(this.repoAppDir, this.file.fileName);

    this.draftDir = path.resolve(percyConfig.draftFolder, this.user.repoFolder);
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
    constructor(private utilService: UtilService, private maintenanceService: MaintenanceService) { }

    /**
     * access the repository and receives the security token to be used in subsequent requests
     * @param auth the authenticate request
     */
    async accessRepo(auth: Authenticate) {
        const { fs, git } = await getGitFS();
        const {user, sessionTimeout} = this.utilService.authenticate(auth);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
        const repoMetadataFile = this.utilService.getMetadataPath(user.repoFolder);

        let existingRepoMetadata;
        if (await fs.exists(repoDir)) {
            // Check repo metadata file
            if (await fs.exists(repoMetadataFile)) {
                try {
                    existingRepoMetadata = await fs.readJson(repoMetadataFile);
                    if (existingRepoMetadata.version !== percyConfig.repoMetadataVersion) {
                      existingRepoMetadata = null;
                    }
                } catch (err) {
                    console.warn(`${repoDir} exists but medata is broken, will clone again`);
                }
            } else {
                console.info(`${repoDir} exists but metadata missing, will clone again`);
            }

            if (!existingRepoMetadata) {
                await fs.remove(repoDir);
            }
        }

        try {
            if (!existingRepoMetadata) {
                // Shallow clone repo with --depth as 1
                try {
                  await this.clone(fs, git, auth, repoDir);
                } catch (err) {
                    // If error while clone remove the repo dir
                    await fs.remove(repoDir);
                    throw err;
                }
            } else {
                // Pull
                await this.pull(git, fs, auth, repoDir, existingRepoMetadata);
            }
        } catch (error) {
            console.error(error);
            throw this.utilService.convertGitError(error);
        }

        const draftFolder = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder);
        await fs.ensureDir(draftFolder);

        await this.maintenanceService.addUserName(user.username);

        // In case of pull, remember the existing commit base SHAs
        const commitBaseSHA = existingRepoMetadata ? existingRepoMetadata.commitBaseSHA || {} : {};

        // Save user to repo metadata locally
        await fs.outputJson(repoMetadataFile, {...user, commitBaseSHA, version: percyConfig.repoMetadataVersion, sessionTimeout});
        return user;
    }

    /**
     * Clone repo. We do a noCheckout action, for performance reason (less files, less I/O).
     * The repo will only contain the '.git' folder, nothing else.
     * The file content will directly be read from pack files in '.git', by using git.readObject.
     */
    private async clone(fs: FSExtra, git: GIT, auth: Authenticate, repoDir: string) {

        const branch = auth.branchName;
        await git.clone({
            url: auth.repositoryUrl,
            username: auth.username,
            password: auth.password,
            ref: branch,
            dir: repoDir,
            corsProxy: percyConfig.corsProxy,
            depth: 1,
            singleBranch: true,
            noCheckout: true // No checkout
        });

        // Set the HEAD ref
        await fs.writeFile(path.resolve(repoDir, '.git', 'HEAD'), `ref: refs/heads/${branch}`);

        // Config branch
        await git.config({dir: repoDir, path: `branch.${branch}.merge`, value: `refs/heads/${branch}`});
        await git.config({dir: repoDir, path: `branch.${branch}.remote`, value: 'origin'});

        // Reset Index to be same with HEAD, so they will not commit. We say this is a 'clean' index.
        // Specific files are added to index only when needed (when delete or commit changes)
        const oid = await this.getRemoteCommit(git, repoDir, branch);
        await this.resetIndexes(fs, git, repoDir, oid, branch);

        console.info(`Cloned repo: ${repoDir}`);

        return oid;
    }

    /**
     * Pull repo.
     *
     * Similar as clone, we never checkout, just fetch from remote repo, and call resetIndexes to keep things clean.
     */
    private async pull(git: GIT, fs: FSExtra, auth: Authenticate, repoDir: string, repoMetadata): Promise<string> {
      try {
        const result = await Promise.race([
          (async() => {
            const lastCommit = await this.getRemoteCommit(git, repoDir, auth.branchName);

            const fetchResult = await git.fetch({
                url: auth.repositoryUrl,
                username: auth.username,
                password: auth.password,
                dir: repoDir,
                ref: auth.branchName,
                depth: 1,
                singleBranch: true,
                remote: 'origin',
                corsProxy: percyConfig.corsProxy
            });

            const fetchHead = fetchResult['fetchHead'];
            if (lastCommit !== fetchHead) {
              // Only need reset Index if commit actaully changes
              await this.resetIndexes(fs, git, repoDir, fetchHead, auth.branchName);
            }

            return fetchHead;
          })(),
          new Promise((resolve, reject) => {
            setTimeout(() => {
              const err = new Error('Pull takes too long, will switch to clone again');
              err.name = 'PullTimeoutError';
              reject(err);
            }, 30 * 1000); // timeout 30 seconds
          })]);
          return result.toString();
      } catch (err) {
        console.error(err);
        if (err.name !== 'PullTimeoutError') {
          throw err;
        }

        // Just in case pull timeout, fallback to clone
        await fs.remove(repoDir);
        return await this.clone(fs, git, auth, repoDir);
      }
    }

    /**
     * Set HEAD to given commit oid, and ensure Index status identical to HEAD status.
     */
    private async resetIndexes(fs: FSExtra, git: GIT, dir: string, oid: string, branch: string) {
        // Save commit oid to HEAD
        await fs.writeFile(path.resolve(dir, '.git', 'refs', 'heads', branch), oid);

        // Remove any workdir files
        const workfiles = await fs.readdir(dir);
        for (let file of workfiles) {
          if (file !== '.git') {
            await fs.remove(path.resolve(dir, file));
          }
        }

        // Ensure Index status identical to HEAD status
        const matrix = await git.statusMatrix({ dir, pattern: '**' });
        for (let row of matrix) {
          if (row[3] !== 1) {
            // Index status not identical to head status, reset index
            // See https://isomorphic-git.org/docs/en/statusMatrix
            await git.resetIndex({ fs: git.plugins.get('fs'), dir, filepath: row[0] });
          }
        }
    }

    private async checkRepoAccess(user: User) {
        const { fs, git } = await getGitFS();

        if (!user || !user.token) {
          throw boom.unauthorized('Miss access token');
        }

        try {
          JSON.parse(this.utilService.decrypt(user.token));
        } catch (err) {
          throw boom.unauthorized('Invalid access token');
        }

        const repoMetadataFile = this.utilService.getMetadataPath(user.repoFolder);
        if (!await fs.exists(repoMetadataFile)) {
          throw boom.unauthorized('Repo metadata not found');
        }

        let repoMetadata: any = await fs.readFile(repoMetadataFile);
        try {
          repoMetadata = JSON.parse(repoMetadata.toString());
        } catch (err) {
          // Not a valid json format, repo metadata file corruption, remove it
          console.warn(`${repoMetadataFile} file corruption, will be removed:\n${repoMetadata}`);
          await fs.remove(repoMetadataFile);
          throw boom.unauthorized('Repo metadata file corruption');
        }

        if (repoMetadata.sessionTimeout < Date.now()) {
          throw boom.unauthorized('Session expired, please re-login');
        }

        // Verify with repo metadata
        if (!_.isEqual(_.omit(user, 'password'),
          _.omit(repoMetadata, 'password', 'sessionTimeout', 'commitBaseSHA', 'version'))) {
          throw boom.forbidden('Repo metadata mismatch, you are not allowed to access the repo');
        }

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
        const password = this.utilService.decrypt(repoMetadata.password);
        user = {...user, password};

        await lock.acquire(repoDir, async() => {
          if (!(await fs.exists(repoDir))) {
            await this.clone(fs, git, user, repoDir);
          }
        });

        // Update session valid time
        repoMetadata.sessionTimeout = Date.now() + ms(percyConfig.loginSessionTimeout);
        await fs.outputJson(repoMetadataFile, repoMetadata);


        return {fs, git, user, repoMetadata};
    }

    /**
     * get the app environments
     * @param user the logged in user
     * @param applicationName the app name
     */
    async getEnvironments(user: User, applicationName: string) {
        const { git } = await this.checkRepoAccess(user);

        const pathFinder = new PathFinder(user, {applicationName, fileName: percyConfig.environmentsFile});

        const oid = await this.getRemoteCommit(git, pathFinder.repoDir, user.branchName);

        if (await this.isRepoFileExists(git, pathFinder)) {
          const {object} = await git.readObject({dir: pathFinder.repoDir, oid, filepath: pathFinder.repoFilePath, encoding: 'utf8'});
          const loaded = this.utilService.convertYamlToTree(object.toString());
          return _.map(_.get(loaded.findChild(['environments']), 'children', []), child => child.key);
        }

        console.warn(`App environments file '${pathFinder.fullFilePath}' does not exist`);
        return [];
    }

    /**
     * Read from git object directly to find yaml files in repo.
     * This method will not read file content, it just traverse the object tree.
     */
    private async findRepoYamlFiles(git, user: User, result: {[key :string]: ConfigFile[]} = {}, depth: number = 0, oid?: string, app?: string) {
      const dir = path.resolve(percyConfig.reposFolder, user.repoFolder);
      if (depth === 0) {
        const remoteOid = await this.getRemoteCommit(git, dir, user.branchName);
        const { object: commit } = await git.readObject({dir, oid: remoteOid});
        oid = (commit as CommitDescription).tree;
      }

      let { object: tree } = await git.readObject({ dir, oid });

      for (let entry of (tree as TreeDescription).entries) {
        if (depth === 0) {
          if (entry.path === percyConfig.yamlAppsFolder && entry.type === 'tree') {
            await this.findRepoYamlFiles(git, user, result, 1, entry.oid);
          }
        } else if (depth === 1) {
          if (entry.type === 'tree') {
            console.log(entry.path)
            if (!result[entry.path]) {
              result[entry.path] = [];
            }
            await this.findRepoYamlFiles(git, user, result, 2, entry.oid, entry.path);
          }
        } else if (depth === 2) {
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
    };

    /**
     * get files for a particular repository.
     *
     * Note: this method never loads file content for performance reason
     *
     * @param user the logged in user
     */
    async getFiles(user: User) {
        const { fs, git } = await this.checkRepoAccess(user);

        const [draft, repoFiles] = await Promise.all([
          this.findDraftFiles(fs, user.repoFolder),
          this.findRepoYamlFiles(git, user),
        ]);

        _.forEach(_.keys(repoFiles), app => {
            if (draft.applications.indexOf(app) === -1) {
              draft.applications.push(app);
            }
            _.forEach(repoFiles[app], repoFile => {
                const draftFile = _.find(draft.files, f => f.applicationName === repoFile.applicationName && f.fileName === repoFile.fileName);
                if (!draftFile) {
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
     */
    private async findDraftFiles(fs: FSExtra, repoFolder: string) {

        const files: ConfigFile[] = [];
        const applications: string[] = [];
        const repoPath = path.resolve(percyConfig.draftFolder, repoFolder);
        const appsPath = path.resolve(repoPath, percyConfig.yamlAppsFolder);
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

        return { files, applications };
    }

    /**
     * get file content of provided file path
     * @param user the logged in user
     * @param file the file to get its draft and original content
     */
    async getFileContent(user: User, file: ConfigFile): Promise<ConfigFile> {
      const { fs, git, repoMetadata } = await this.checkRepoAccess(user);

        const pathFinder = new PathFinder(user, file);

        const oid = await this.getRemoteCommit(git, pathFinder.repoDir, user.branchName);
        let originalConfig: Configuration;

        if (await this.isRepoFileExists(git, pathFinder)) {
          const { object } = await git.readObject({dir: pathFinder.repoDir, oid, filepath: pathFinder.repoFilePath, encoding: 'utf8'});
          originalConfig = new Configuration(this.utilService.convertYamlToTree(object.toString()));
        }

        let draftConfig: Configuration;
        if (await fs.exists(pathFinder.draftFullFilePath)) {
          const content = await fs.readFile(pathFinder.draftFullFilePath);
          draftConfig = new Configuration(this.utilService.convertYamlToTree(content.toString()));
        }

        if (!originalConfig && !draftConfig) {
            throw new Error(`File '${file.applicationName}/${file.fileName}' does not exist`);
        }

        file.modified = draftConfig ? !_.isEqual(originalConfig, draftConfig) : false;

        if (draftConfig && !file.modified) {
            // Remove draft file
            await fs.remove(pathFinder.draftFullFilePath);
            // Clear commit base SHA
            await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' });
        }

        return { ...file, draftConfig, originalConfig };
    }

    /**
     * Get remote commit.
     */
    private async getRemoteCommit(git: GIT, repoDir: string, branch: string) {
      return await git.resolveRef({
        dir: repoDir,
        ref: path.join('remotes', 'origin', branch)
      });
    }

    /**
     * Save commit base SHA (which is file's oid).
     */
    private async saveCommitBaseSHA(fs: FSExtra, repoMetadata, baseSHAs: {[filepath: string]: string}) {
        let anyChange = false;
        _.each(baseSHAs, (baseSHA, filepath) => {
          if (!baseSHA) {
            if (repoMetadata.commitBaseSHA[filepath]) {
              delete repoMetadata.commitBaseSHA[filepath];
              anyChange = true;
            }
          } else {
            if (repoMetadata.commitBaseSHA[filepath] !== baseSHA) {
              repoMetadata.commitBaseSHA[filepath] = baseSHA;
              anyChange = true;
            }
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
    async saveDraft(user: User, file: ConfigFile) {
      const { fs, git, repoMetadata } = await this.checkRepoAccess(user);

        const pathFinder = new PathFinder(user, file);

        if (!file.modified) {
            // Not modified, don't need draft file
            const repoFileExists = await this.isRepoFileExists(git, pathFinder);
            const draftFileExists = await fs.exists(pathFinder.draftFullFilePath);
            if (repoFileExists && draftFileExists) {
                console.info(`Draft file '${file.applicationName}/${file.fileName}' found to have same content as repo, will be deleted`)
                await fs.remove(pathFinder.draftFullFilePath);
            }
            // Clear commit base SHA
            await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' });
        } else {
            // Save draft
            await fs.ensureDir(pathFinder.draftAppDir);

            // Only save the draft config
            await fs.writeFile(pathFinder.draftFullFilePath, this.utilService.convertTreeToYaml(file.draftConfig));

            if (!repoMetadata.commitBaseSHA[pathFinder.repoFilePath]) {
                // Save commit base SHA
                await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: file.oid });
            }
        }

        return file;
    }

    /**
     * Check if file exists in repo.
     */
    private async isRepoFileExists(git: GIT, pathFinder: PathFinder) {
        const status = await git.status({ dir: pathFinder.repoDir, filepath: pathFinder.repoFilePath });
        return status !== 'absent';
    }

    /**
     * deletes the file within the given location from the repository
     * @param auth the logged in user
     * @param file the file to delete
     */
    async deleteFile(auth: User, file: ConfigFile) {
        const { fs, git, user, repoMetadata } = await this.checkRepoAccess(auth);
        const pathFinder = new PathFinder(user, file);

        let gitPulled = false;
        if (await this.isRepoFileExists(git, pathFinder)) {
  
            const lastCommit = await this.pull(git, fs, user, pathFinder.repoDir, repoMetadata);
            gitPulled = true;

            // Check whether exists again after pull
            if (await this.isRepoFileExists(git, pathFinder)) {
  
              try {
                  if (await fs.exists(pathFinder.fullFilePath)) {
                    // Just in case file exist in workdir
                    await fs.remove(pathFinder.fullFilePath);
                  }
      
                  await git.remove({
                      dir: pathFinder.repoDir,
                      filepath: pathFinder.repoFilePath
                  });
      
                  const commitSHA = await git.commit({
                      dir: pathFinder.repoDir,
                      message: 'Percy delete',
                      author: {
                          name: user.username,
                          email: user.username
                      }
                  });
  
                  await git.push({
                      dir: pathFinder.repoDir,
                      ref: user.branchName,
                      username: user.username,
                      password: user.password,
                      corsProxy: percyConfig.corsProxy,
                  });

                  // Weird bug, isogit sometimes don't update the remote commit SHA
                  await fs.writeFile(path.resolve(pathFinder.repoDir, '.git', 'refs', 'remotes', 'origin', user.branchName), commitSHA);
                  await this.resetIndexes(fs, git, pathFinder.repoDir, commitSHA, user.branchName);
              } catch (err) {
                  await this.resetIndexes(fs, git, pathFinder.repoDir, lastCommit, user.branchName);
                  throw err;
              }
            }
        }

        // Also delete draft file if any
        if (await fs.exists(pathFinder.draftFullFilePath)) {
            await fs.remove(pathFinder.draftFullFilePath);
        }
        // Also delete commit base SHA if any
        await this.saveCommitBaseSHA(fs, repoMetadata, {[pathFinder.repoFilePath]: ''});

        return gitPulled;
    }

    /**
     * Resolve conflicts
     * @param auth the logged in user
     * @param configFiles the config files to commit
     * @param message the commit message
     */
    async resovelConflicts(auth: User, configFiles: ConfigFile[], message: string) {
      const modified: ConfigFile[] = [];
      const unchanged: ConfigFile[] = [];

      await Promise.all(configFiles.map(async(file) => {
        file.modified = !_.isEqual(file.draftConfig, file.originalConfig);

        if (file.modified) {
          modified.push(file);
        } else {
          await this.saveDraft(auth, file); // This will clean draft data
          unchanged.push(file);
        }
      }));

      if (modified.length) {
        const committed = await this.commitFiles(auth, modified, message, true);
        return _.concat(committed, unchanged);
      }

      return unchanged;
    }

    /**
     * Commits the files
     * @param auth the logged in user
     * @param configFiles the config files to commit
     * @param message the commit message
     * @param forcePush the flag indicates whether to force push
     */
    async commitFiles(auth: User, configFiles: ConfigFile[], message: string, forcePush: boolean = false) {
        const { fs, git, user, repoMetadata } = await this.checkRepoAccess(auth);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);

        let lastRepoFiles: ConfigFile[];
        let newRepoFiles: ConfigFile[];

        if (!forcePush) {
          const lastMap = await this.findRepoYamlFiles(git, user);
          lastRepoFiles = _.reduce(lastMap, (r, v) => r.concat(v), []);
        }

        const lastCommit = await this.pull(git, fs, user, repoDir, repoMetadata);

        if (!forcePush) {
          const newMap = await this.findRepoYamlFiles(git, user);
          newRepoFiles = _.reduce(newMap, (r, v) => r.concat(v), []);
        }

        // Do optimistic check
        const conflictFiles: ConfigFile[] = [];
        let commitBaseSHA = _.cloneDeep(repoMetadata.commitBaseSHA);
        await Promise.all(configFiles.map(async(file) => {

            const pathFinder = new PathFinder(user, file);

            if (!file.draftConfig) {
              const content = await fs.readFile(pathFinder.draftFullFilePath);
              file.draftConfig = new Configuration(this.utilService.convertYamlToTree(content.toString()));
            }

            if (!forcePush) {
              let oldOid = commitBaseSHA[pathFinder.repoFilePath];
              if (!oldOid) {
                const found = _.find(lastRepoFiles, f => f.applicationName === file.applicationName && f.fileName === file.fileName);
                if (found) {
                  commitBaseSHA[pathFinder.repoFilePath] = oldOid = found.oid;
                }
              }

              const newFound = _.find(newRepoFiles, f => f.applicationName === file.applicationName && f.fileName === file.fileName);
              const newOid = newFound ? newFound.oid : null;

              if ((!oldOid && newOid) || (oldOid && newOid && oldOid !== newOid)) { // Should conflict if found to be deleted?
                const { object } = await git.readObject({dir: pathFinder.repoDir, oid: lastCommit, filepath: pathFinder.repoFilePath, encoding: 'utf8'});
                const originalConfig = new Configuration(this.utilService.convertYamlToTree(object.toString()));
                conflictFiles.push({
                    ...file,
                    originalConfig,
                });
              }
            }
        }));

        if (conflictFiles.length) {
            await this.saveCommitBaseSHA(fs, repoMetadata, commitBaseSHA);

            const names = conflictFiles.map((file) => `• ${file.applicationName}/${file.fileName}`).join('\n');
            const error = boom.conflict<ConfigFile[]>(`The following file(s) are already changed in the repository:\n${names}`);
            error.data = conflictFiles;
            throw error;
        }

        let commitSHA;
        try {
            // Commit
            await Promise.all(configFiles.map(async(file) => {
                const folderPath = path.resolve(repoDir, percyConfig.yamlAppsFolder, file.applicationName);
                const fullFilePath = path.resolve(folderPath, file.fileName);
    
                await fs.ensureDir(folderPath);
        
                // Convert json to yaml
                await fs.writeFile(fullFilePath, this.utilService.convertTreeToYaml(file.draftConfig));
        
                file.size = (await fs.stat(fullFilePath)).size;

                // Add file to index
                await git.add({
                    dir: repoDir,
                    filepath: path.join(percyConfig.yamlAppsFolder, file.applicationName, file.fileName)
                });
            }));
        
            commitSHA = await git.commit({
                dir: repoDir,
                message,
                author: {
                    name: user.username,
                    email: user.username
                }
            });

            // Push
            await git.push({
                dir: repoDir,
                ref: user.branchName,
                username: user.username,
                password: user.password,
                corsProxy: percyConfig.corsProxy,
                force: forcePush
            });

            // Weird bug, isogit sometimes don't update the remote commit SHA
            await fs.writeFile(path.resolve(repoDir, '.git', 'refs', 'remotes', 'origin', user.branchName), commitSHA);
            await this.resetIndexes(fs, git, repoDir, commitSHA, user.branchName);
        } catch (err) {
            await this.resetIndexes(fs, git, repoDir, lastCommit, user.branchName);
            throw err;
        }

        // Delete draft files
        commitBaseSHA = {};
        await Promise.all(configFiles.map(async(file) => {
            const pathFinder = new PathFinder(user, file);
            if (await fs.exists(pathFinder.draftFullFilePath)) {
                await fs.remove(pathFinder.draftFullFilePath);
            }
            file.modified = false;
            file.originalConfig = file.draftConfig;
            commitBaseSHA[pathFinder.repoFilePath] = '';
        }));

        // Clear commit base SHAs
        await this.saveCommitBaseSHA(fs, repoMetadata, commitBaseSHA);

        return configFiles;
    }
}
