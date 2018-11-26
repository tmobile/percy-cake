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
        const {user, validUntil} = this.utilService.authenticate(auth);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
        const repoMetadataFile = this.utilService.getMetadataPath(user.repoFolder);

        let needClone = true;
        if (await fs.exists(repoDir)) {
            // Check repo metadata file
            let repoMetadataFileOk = false;

            if (await fs.exists(repoMetadataFile)) {
                const metadata = await fs.readFile(repoMetadataFile);
                try {
                    JSON.parse(metadata.toString());
                    repoMetadataFileOk = true;
                } catch (err) {
                    console.warn(`${repoDir} exists but medata is broken, will clone again`);
                }
            } else {
                console.info(`${repoDir} exists but metadata missing, will clone again`);
            }

            if (!repoMetadataFileOk) {
                await fs.remove(repoDir);
            } else {
                needClone = false;
            }
        }

        try {
            if (needClone) {
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
                await this.pull(fs, git, {...user, password: auth.password}, repoDir);
            }
        } catch (error) {
            console.error(error);
            throw this.utilService.convertGitError(error);
        }

        const draftFolder = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder);
        await fs.ensureDir(draftFolder);

        await this.maintenanceService.addUserName(user.username);

        // Save user to repo metadata locally
        await fs.outputJson(repoMetadataFile, {...user, validUntil});

        return user;
    }

    /**
     * Pull repo.
     * @param fs the fs
     * @param git the git
     * @param user the logged in user
     * @param repoDir the repo dir
     */
    private async pull(fs: FSExtra, git: GIT, user: User, repoDir: string) {
      // Reset to upstream, and remember that last commit
      const lastCommit = await this.resetToUpstream(fs, git, repoDir, user.branchName);

      // pull
      await git.pull({
          username: user.username,
          password: user.password,
          dir: repoDir,
          ref: user.branchName,
          singleBranch: true
      });

      const status = await git.statusMatrix({ dir: repoDir, ref: lastCommit, pattern: `${percyConfig.yamlAppsFolder}/**` });

      // The files deleted by the pull
      const deletedFiles = status.filter(row => row[2] === 0).map(row => row[0])

      // Really remove orphan draft ?
      await Promise.all(deletedFiles.map(async (file) => {
        const filepath = path.resolve(percyConfig.draftFolder, user.repoFolder, file);
        if (await fs.exists(filepath)) {
          await fs.remove(filepath);
        }
      }));
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
        const { fs, git } = await getGitFS();
        await this.utilService.checkRepoAccess(user, fs);

        const appName = file.applicationName;
        const fileName = file.fileName;
        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);

        let originalConfig;
        const repoFilePath = path.resolve(repoDir, percyConfig.yamlAppsFolder, appName, fileName);
        if (await fs.exists(repoFilePath)) {
            originalConfig = this.utilService.convertYamlToJson((await fs.readFile(repoFilePath)).toString());
        }

        let draftFile;
        const draftFilePath = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder, appName, fileName);
        if (await fs.exists(draftFilePath)) {
            draftFile = JSON.parse((await fs.readFile(draftFilePath)).toString());
        }

        if (!originalConfig && !draftFile) {
            throw new Error(`File '${appName}/${fileName}' does not exist`);
        }

        let modified = false;
        if (draftFile) {
            modified = !_.isEqual(originalConfig, draftFile.draftConfig);
            if (!modified) {
                // This rarely happen (may be after pull triggered by another commit/delete)
                console.warn(`Draft file '${appName}/${fileName}' found to have same content as repo, will be deleted`)
                await fs.remove(draftFilePath);
            }
        } else {
            file.draftBaseSHA = await this.getFileSHA(git, user, repoDir, file);
        }

        return { ...file, ...(draftFile || {}), originalConfig, modified };
    }

    /**
     * Save draft file.
     * @param user the logged in user
     * @param file the draft file to save
     */
    async saveDraft(user: User, file: ConfigFile) {
        const { fs } = await getGitFS();
        await this.utilService.checkRepoAccess(user, fs);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);
        const repoFilePath = path.resolve(repoDir, percyConfig.yamlAppsFolder, file.applicationName, file.fileName);

        const draftDir = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder, file.applicationName);
        const draftFilePath = path.resolve(draftDir, file.fileName);

        if (!file.modified) {
            const repoFileExists = await fs.exists(repoFilePath);
            const draftFileExists = await fs.exists(draftFilePath);
            if (repoFileExists && draftFileExists) {
                // Not modified, don't need draft
                await fs.remove(draftFilePath);
            }
        } else {
            // Save draft
            await fs.ensureDir(draftDir);
            // Only save the draft config and timestamp
            await fs.writeFile(draftFilePath, JSON.stringify(_.pick(file, ['draftConfig', 'draftBaseSHA'])));
        }

        return file;
    }

    /**
     * Get file SHA.
     * @param git the git
     * @param user the logged in user
     * @param repoDir the repo dir
     * @param file the file to get its SHA
     */
    private async getFileSHA(git: GIT, user: User, repoDir: string, file: ConfigFile) {

        const remoteCommit = await git.resolveRef({
            dir: repoDir,
            ref: `remotes/origin/${user.branchName}`
        });
        const filepath = path.join(percyConfig.yamlAppsFolder, file.applicationName, file.fileName);
        const object = await git.readObject({
            dir: repoDir,
            oid: remoteCommit,
            format: 'deflated',
            filepath,
        })
        return object.oid;
    }

    /**
     * deletes the file within the given location from the repository
     * @param user the logged in user
     * @param file the file to delete
     */
    async deleteFile(user: User, file: ConfigFile) {
        const { fs, git } = await getGitFS();

        user = await this.utilService.checkRepoAccess(user, fs);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);

        const repoFilePath = path.resolve(repoDir, percyConfig.yamlAppsFolder, file.applicationName, file.fileName);

        let gitPulled = false;
        if (await fs.exists(repoFilePath)) {
  
            await this.pull(fs, git, user, repoDir);
            gitPulled = true;

            try {
                await fs.remove(repoFilePath);
    
                await git.remove({
                    dir: repoDir,
                    filepath: path.join(percyConfig.yamlAppsFolder, file.applicationName, file.fileName)
                });
    
                const commitSHA = await git.commit({
                    dir: repoDir,
                    message: 'Percy delete',
                    author: {
                        name: user.username,
                        email: user.username
                    }
                });

                await git.push({
                    dir: repoDir,
                    ref: user.branchName,
                    username: user.username,
                    password: user.password,
                    corsProxy: percyConfig.corsProxy,
                });

                // Wired bug, isogit sometimes don't update the remote commit SHA
                await fs.writeFile(path.resolve(repoDir, '.git', 'refs', 'remotes', 'origin', user.branchName), commitSHA);
            } catch (err) {
                await this.resetToUpstream(fs, git, repoDir, user.branchName);
                throw err;
            }
        }

        const draftFilePath = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder,
            file.applicationName, file.fileName);
        if (await fs.exists(draftFilePath)) {
            await fs.remove(draftFilePath);
        }

        return gitPulled;
    }

    /**
     * Reset to upstream.
     * @param fs the fs
     * @param git the git
     * @param dir the repo dir
     * @param branch the branch to reset
     */
    private async resetToUpstream(fs: FSExtra, git: GIT, dir: string, branch: string) {
        const remoteCommit = await git.resolveRef({
            dir,
            ref: path.join('remotes', 'origin', branch)
        });
        await fs.writeFile(path.resolve(dir, '.git', 'refs', 'heads', branch), remoteCommit);
        await fs.unlink(path.resolve(dir, '.git', 'index'));
        await git.checkout({ dir, ref: branch });
        return remoteCommit;
    }

    /**
     * Commits the files
     * @param user the logged in user
     * @param configFiles the config files to commit
     * @param message the commit message
     */
    async commitFiles(user: User, configFiles: ConfigFile[], message: string) {
        const { fs, git } = await getGitFS();

        user = await this.utilService.checkRepoAccess(user, fs);

        const repoDir = path.resolve(percyConfig.reposFolder, user.repoFolder);

        await this.pull(fs, git, user, repoDir);

        // Do optimistic check
        await Promise.all(configFiles.map(async(file) => {
            if (!file.draftBaseSHA) {
                // Load draft timestamp if not present
                const draftFilePath = path.resolve(percyConfig.draftFolder, user.repoFolder,
                    percyConfig.yamlAppsFolder, file.applicationName, file.fileName);
                if (await fs.exists(draftFilePath)) {
                    const draft = JSON.parse((await fs.readFile(draftFilePath)).toString());
                    file.draftBaseSHA = draft.draftBaseSHA;
                }
            }
        }));

        const conflictFiles: ConfigFile[] = [];
        await Promise.all(configFiles.map(async(file) => {
            const applicationName = file.applicationName;
            const fileName = file.fileName;
            const fullFilePath = path.resolve(repoDir, percyConfig.yamlAppsFolder, applicationName, fileName);

            if (file.draftBaseSHA && await fs.exists(fullFilePath)) {
                // New SHA after pull
                const newSHA = await this.getFileSHA(git, user, repoDir, file);
                if (file.draftBaseSHA !== newSHA) {
                    conflictFiles.push({
                        fileName,
                        applicationName,
                        draftBaseSHA: newSHA,
                        originalConfig: this.utilService.convertYamlToJson((await fs.readFile(fullFilePath)).toString()),
                    });
                }
            }
        }));

        if (conflictFiles.length) {
            const names = conflictFiles.map((file) => `• ${file.applicationName}/${file.fileName}`).join('\n');
            const error = boom.conflict<ConfigFile[]>(`The following file(s) are already changed in the repository:\n${names}`);
            error.data = conflictFiles;
            throw error;
        }

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
        
            const commitSHA = await git.commit({
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
            });

            // Wired bug, isogit sometimes don't update the remote commit SHA
            await fs.writeFile(path.resolve(repoDir, '.git', 'refs', 'remotes', 'origin', user.branchName), commitSHA);

        } catch (err) {
            await this.resetToUpstream(fs, git, repoDir, user.branchName);
            throw err;
        }

        await Promise.all(configFiles.map(async(file) => {
            const draftFilePath = path.resolve(percyConfig.draftFolder, user.repoFolder, percyConfig.yamlAppsFolder,
                file.applicationName, file.fileName);
            if (await fs.exists(draftFilePath)) {
                await fs.unlink(draftFilePath);
            }
        }));

        return configFiles;
    }
}
