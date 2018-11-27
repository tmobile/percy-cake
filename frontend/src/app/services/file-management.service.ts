import { Injectable } from '@angular/core';
import * as path from 'path';
import * as yamlJS from 'yaml-js';
import * as boom from 'boom';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { ConfigFile } from 'models/config-file';
import { getGitFS, GIT, FSExtra } from './git-fs.service';
import { UtilService } from './util.service';
import { User, Authenticate } from 'models/auth';
import { MaintenanceService } from './maintenance.service';

class PathFinder {

  public readonly repoDir: string;
  public readonly repoAppDir: string;
  public readonly repoFilePath: string;
  public readonly fullFilePath: string;

  public readonly draftDir: string;
  public readonly draftAppDir: string;
  public readonly draftFullFilePath: string;

  constructor(private user:User, private file: ConfigFile) {
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
                    await git.clone({
                        url: auth.repositoryUrl,
                        username: auth.username,
                        password: auth.password,
                        ref: auth.branchName,
                        dir: repoDir,
                        corsProxy: percyConfig.corsProxy,
                        depth: 1,
                        singleBranch: true
                    });

                    console.info(`Cloned repo: ${repoDir}`);
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
     * Pull repo.
     * @param fs the fs
     * @param git the git
     * @param user the logged in user
     * @param repoDir the repo dir
     */
    private async pull(git: GIT, fs: FSExtra, auth: Authenticate, repoDir: string, repoMetadata) {
      try {
        await Promise.race([
          (async() => {
            let currentCommit = await this.getRemoteCommit(git, repoDir, auth.branchName);
            const fetchResult = await git.fetch({
                username: auth.username,
                password: auth.password,
                dir: repoDir,
                ref: auth.branchName,
                singleBranch: true,
                url: auth.repositoryUrl,
                remote: 'origin',
                corsProxy: percyConfig.corsProxy
            });
            const fetchHead = fetchResult['fetchHead'];
            if (currentCommit === fetchHead) {
              // Nothing changes
              return;
            }
            await git.merge({
              dir: repoDir,
              ours: auth.branchName,
              theirs: fetchHead,
            });
            await git.checkout({
              dir: repoDir,
              ref: auth.branchName,
            })
          })(),
          new Promise((resolve, reject) => {
            setTimeout(() => {
              const err = new Error('Pull takes too long, will switch to clone again');
              err.name = 'PullTimeoutError';
              reject(err);
            }, 30 * 1000); // timeout 30 seconds
          })]);
      } catch (err) {
        console.error(err);
        if (err.name !== 'PullTimeoutError') {
          throw err;
        }

        await fs.remove(repoDir);
        await git.clone({
            url: auth.repositoryUrl,
            username: auth.username,
            password: auth.password,
            ref: auth.branchName,
            dir: repoDir,
            corsProxy: percyConfig.corsProxy,
            depth: 1,
            singleBranch: true
        });
        const commitBaseSHA = _.mapValues(repoMetadata.commitBaseSHA, () => '');
        await this.saveCommitBaseSHA(fs, repoMetadata, commitBaseSHA);
      }
    }

    /**
     * get the app environments
     * @param user the logged in user
     * @param appName the app name
     */
    async getEnvironments(user: User, appName: string) {
        const { fs } = await getGitFS();
        await this.utilService.checkRepoAccess(user, fs);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
        const fullFilePath = path.resolve(repoDir, percyConfig.yamlAppsFolder, appName, percyConfig.environmentsFile);

        if (!await fs.exists(fullFilePath)) {
            console.warn(`App environments file '${fullFilePath}' does not exist`);
            return [];
        }

        const loaded = yamlJS.load((await fs.readFile(fullFilePath)).toString());
        return loaded.default;
    }

    /**
     * get files for a particular repository.
     *
     * Note: this method never loads file content for performance reason
     *
     * @param user the logged in user
     */
    async getFiles(user: User) {
        const { fs } = await getGitFS();
        await this.utilService.checkRepoAccess(user, fs);

        const [repo, draft] = await Promise.all([
            this.findFiles(fs, user.repoFolder, false),
            this.findFiles(fs, user.repoFolder, true)
        ]);

        _.forEach(draft.applications, app => {
            if (repo.applications.indexOf(app) === -1) {
                repo.applications.push(app);
            }
        });

        _.forEach(draft.files, draftFile => {
            const file = _.find(repo.files, f => f.applicationName === draftFile.applicationName && f.fileName === draftFile.fileName);
            if (!file) {
                repo.files.push(draftFile);
            } else {
                _.assign(file, draftFile);
            }
        });

        return repo;
    }

    /**
     * Find files.
     *
     * Note: this method never loads file content for performance reason
     *
     * @param fs the FS
     * @param repoFolder the repo folder name
     * @param forDraft the flag indicates whether for finding draft files
     */
    private async findFiles(fs: FSExtra, repoFolder: string, forDraft: boolean) {

        const files: ConfigFile[] = [];
        const applications: string[] = [];
        const repoPath = path.resolve(forDraft ? percyConfig.draftFolder : percyConfig.reposFolder, repoFolder);
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
                        size: stat.size
                    };
                    if (forDraft) {
                        // For those draft files, we simply assume they're modified
                        file.modified = true;
                    }
                    files.push(file);
                }
            }));
        }));

        return { files: _.sortBy(files, 'fileName', 'applicationName'), applications };
    }

    /**
     * get file content of provided file path
     * @param user the logged in user
     * @param file the file to get its draft and original content
     */
    async getFileContent(user: User, file: ConfigFile) {
        const { fs } = await getGitFS();
        const { repoMetadata } = await this.utilService.checkRepoAccess(user, fs);

        const pathFinder = new PathFinder(user, file);

        let originalConfig;
        if (await fs.exists(pathFinder.fullFilePath)) {
            // For new file, there is no originalConfig
            originalConfig = this.utilService.convertYamlToJson((await fs.readFile(pathFinder.fullFilePath)).toString());
        }

        let draftFile;
        if (await fs.exists(pathFinder.draftFullFilePath)) {
            draftFile = await fs.readJson(pathFinder.draftFullFilePath);
        }

        if (!originalConfig && !draftFile) {
            throw new Error(`File '${file.applicationName}/${file.fileName}' does not exist`);
        }

        file.modified = draftFile ? !_.isEqual(originalConfig, draftFile.draftConfig) : false;

        if (draftFile && !file.modified) {
            // Remove draft file
            await fs.remove(pathFinder.draftFullFilePath);
            // Clear commit base SHA
            await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: '' });
        }

        return { ...file, ...(draftFile || {}), originalConfig };
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
     * Save commit base SHA.
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
     * @param auth the logged in user
     * @param file the draft file to save
     */
    async saveDraft(auth: User, file: ConfigFile) {
        const { fs, git } = await getGitFS();
        const { repoMetadata } = await this.utilService.checkRepoAccess(auth, fs);

        const pathFinder = new PathFinder(auth, file);

        if (!file.modified) {
            // Not modified, don't need draft file
            const repoFileExists = await fs.exists(pathFinder.fullFilePath);
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
            await fs.outputJson(pathFinder.draftFullFilePath, {draftConfig: file.draftConfig});

            if (!repoMetadata.commitBaseSHA[pathFinder.repoFilePath]) {
                // Align commit base SHA to remote commit
                const remoteCommit = await this.getRemoteCommit(git, pathFinder.repoDir, auth.branchName);
                await this.saveCommitBaseSHA(fs, repoMetadata, { [pathFinder.repoFilePath]: remoteCommit });
            }
        }

        return file;
    }

    /**
     * Reset to upstream.
     * @param fs the fs
     * @param git the git
     * @param dir the repo dir
     * @param branch the branch to reset
     */
    private async resetToUpstream(fs: FSExtra, git: GIT, dir: string, branch: string) {
        const remoteCommit = await this.getRemoteCommit(git, dir, branch);
        await fs.writeFile(path.resolve(dir, '.git', 'refs', 'heads', branch), remoteCommit);
        await git.checkout({ dir, ref: branch });
        return remoteCommit;
    }

    /**
     * deletes the file within the given location from the repository
     * @param auth the logged in user
     * @param file the file to delete
     */
    async deleteFile(auth: User, file: ConfigFile) {
        const { fs, git } = await getGitFS();

        const {user, repoMetadata} = await this.utilService.checkRepoAccess(auth, fs);
        const pathFinder = new PathFinder(user, file);

        let gitPulled = false;
        if (await fs.exists(pathFinder.fullFilePath)) {
  
            await this.pull(git, fs, user, pathFinder.repoDir, repoMetadata);
            gitPulled = true;

            if (await fs.exists(pathFinder.fullFilePath)) {
  
              try {
                  await fs.remove(pathFinder.fullFilePath);
      
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
              } catch (err) {
                  await this.resetToUpstream(fs, git, pathFinder.repoDir, user.branchName);
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

    private async getStatusChanges(git: GIT, pathFinder: PathFinder, commit: string) {

      const status = await git.statusMatrix({ dir: pathFinder.repoDir, ref: commit, pattern: pathFinder.repoFilePath });

      const result: {[filePath: string]: string} = {};

      // See https://isomorphic-git.org/docs/en/statusMatrix
      _.each(status, row => {
        if (row[1] === 0) {
          result[row[0]] = 'added';
        } else if (row[2] === 0) {
          result[row[0]] = 'deleted';
        } else if (row[2] === 2) {
          result[row[0]] = 'modified';
        }
      });
      return result;
    }

    /**
     * Commits the files
     * @param auth the logged in user
     * @param configFiles the config files to commit
     * @param message the commit message
     * @param forcePush the flag indicates whether to force push
     */
    async commitFiles(auth: User, configFiles: ConfigFile[], message: string, forcePush: boolean = false) {
        const { fs, git } = await getGitFS();

        const {user, repoMetadata} = await this.utilService.checkRepoAccess(auth, fs);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);

        // remeber last commit before pull
        const lastCommit = await this.getRemoteCommit(git, repoDir, user.branchName);
        await this.pull(git, fs, user, repoDir, repoMetadata);

        // Do optimistic check
        const conflictFiles: ConfigFile[] = [];
        let commitBaseSHA = _.cloneDeep(repoMetadata.commitBaseSHA);
        await Promise.all(configFiles.map(async(file) => {

            const pathFinder = new PathFinder(user, file);

            if (!file.draftConfig) {
              file.draftConfig = (await fs.readJson(pathFinder.draftFullFilePath)).draftConfig; 
            }

            if (!forcePush) {
              commitBaseSHA[pathFinder.repoFilePath] = commitBaseSHA[pathFinder.repoFilePath] || lastCommit;
              const statusChange = await this.getStatusChanges(git, pathFinder, commitBaseSHA[pathFinder.repoFilePath]);
  
              if (statusChange[pathFinder.repoFilePath] === 'modified'
                  || statusChange[pathFinder.repoFilePath] === 'added') { // Should conflict if found to be deleted?
                conflictFiles.push({
                    ...file,
                    originalConfig: this.utilService.convertYamlToJson((await fs.readFile(pathFinder.fullFilePath)).toString()),
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
                await fs.writeFile(fullFilePath, this.utilService.convertJsonToYaml(file.draftConfig));
        
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
        } catch (err) {
            await this.resetToUpstream(fs, git, repoDir, user.branchName);
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
