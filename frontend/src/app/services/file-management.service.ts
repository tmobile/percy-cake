import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as path from 'path';
import * as yamlJS from 'yaml-js';
import * as _ from 'lodash';

import * as rimraf from 'rimraf';
import * as thenify from 'thenify';

import { environment } from 'config';
import { ConfigFile } from 'models/config-file';
import { getGitFS } from './git.service';
import { HttpHelperService } from './http-helper.service';
import { UtilService } from './util.service';
import { percyConfig } from '../../environments/environment.prod';

const rimrafAsync = thenify(rimraf);

/**
 * This service provides the methods around the file management API endpoints
 */
@Injectable({ providedIn: 'root' })
export class FileManagementService {

    /**
     * initializes the service
     * @param httpHelperService the http helper service
     */
    constructor(private httpHelperService: HttpHelperService,
      private utilService: UtilService) { }

    /**
     * Create repo url with username and password.
     * @param metadata Metadata contains repo url, username and password.
     * @returns Repo url
     * @private
     */
    // private createRepoURL = (metadata) => {
    //   const url = new URL(metadata.repoURL);
    //   url.username = metadata.username;
    //   url.password = this.utilService.decrypt(metadata.password);
    //   return url;
    // };

    async cleanRepo(repoPath: string) {
      await rimrafAsync(repoPath);
    }

    /**
     * access the repository and receives the security token to be used in subsequent requests
     * @param repoURL the repository URL
     * @param branchName the branch name
     * @param username the username
     * @param password the password
     */
    async accessRepo(repoURL: string, branchName: string, username: string, password: string) {
      const { fs, git } = await getGitFS();
      const repoName = this.utilService.getRepoName(new URL(repoURL));
      const repoMetadata = {
        // Remove '.git' from the end of repo url
        repoURL: repoURL.replace(/\.git$/, ''),
        username,
        password: this.utilService.encrypt(password),
        branchName,
        repoName
      };

      const repoPath = this.utilService.getRepoPath(repoMetadata);
      const repoMetadataFile = this.utilService.getMetadataPath(repoMetadata);
    
      let needClone = true;
      if (await fs.exists(repoPath)) {
        // await rimrafAsync(repoPath);
        // Check repo metadata file
        let repoMetadataFileOk = false;

        if (await fs.exists(repoMetadataFile)) {
          const metadata = await fs.readFile(repoMetadataFile);
          try {
            JSON.parse(metadata.toString());
            repoMetadataFileOk = true;
          } catch (err) {
            console.warn(`${repoPath} exists but medata is broken, will clone again`);
          }
        } else {
          console.info(`${repoPath} exists but metadata missing, will clone again`);
        }

        if (!repoMetadataFileOk) {
          await rimrafAsync(repoPath);
        } else {
          needClone = false;
        }
      }
      // if (await fs.exists(repoMetadataFile)) {
      //   await fs.unlink(repoMetadataFile);
      // }

      try {
        if (needClone) {
          // Shallow clone repo with --depth as 1
          try {
            await git.clone({
              fs,
              url: repoURL,
              username,
              password,
              ref: branchName,
              dir: repoPath,
              corsProxy: environment.api.corsProxy,
              depth: 1,
              singleBranch: true
            });

            console.info(`Cloned repo: ${repoPath}`);
          } catch (err) {
            // If error while clone remove the repo dir
            await rimrafAsync(repoPath);
            throw err;
          }
        } else {
          // Reset the branch and pull the update
          await git.pull({
            fs,
            username,
            password,
            dir: repoPath,
            ref: branchName,
            singleBranch: true
          });
        }
      } catch (error) {
        console.error(error);
        throw this.utilService.convertGitError(error);
      }

      // Save repo metadata locally
      await fs.writeFile(repoMetadataFile, JSON.stringify(repoMetadata));

      return { repoPath, repoName };
    }

    /**
     * get files for a particular repository
     * @param repoPath the repository path
     * @param branchName the branch name
     */
    async getFiles(repoPath: string, branchName: string) {
      const { fs, git } = await getGitFS();

      const files = [];
      const applications = [];
      const appsPath = path.resolve(repoPath, percyConfig.yamlAppsFolder);
      const apps = await fs.readdir(appsPath);

      await Promise.all(apps.map(async(applicationName) => {
        const appPath = path.resolve(appsPath, applicationName);
        if (!(await fs.stat(appPath)).isDirectory()) {
          return;
        }
        applications.push(applicationName);
        const appFiles = await fs.readdir(appPath);
        await Promise.all(appFiles.map(async(appFile) => {
          const stat = await fs.stat(path.resolve(appPath, appFile));
          if (!stat.isFile()) {
            return;
          }
          const ext = path.extname(appFile).toLowerCase();
          if (ext === '.yaml' || ext === '.yml') {
            const currentCommit = await git.resolveRef({ dir: repoPath, ref: branchName })
            const filepath = path.join(percyConfig.yamlAppsFolder, applicationName, appFile);
            const object = await git.readObject({
              dir: repoPath,
              oid: currentCommit,
              format: 'deflated',
              filepath,
            })
            files.push({
              applicationName,
              fileName: appFile,
              timestamp: object.oid,
              size: stat.size,
            });
          }
        }));
      }));

      return {files: _.sortBy(files, 'fileName', 'applicationName'), applications };
    }

    /**
     * get file content of provided file path
     * @param repoPath the repository path
     * @param appName the app name
     * @param fileName the file name
     */
    async getFileContent(repoPath: string, appName: string, fileName: string) {
        const { fs } = await getGitFS();
        const fullFilePath = path.resolve(repoPath, percyConfig.yamlAppsFolder, appName, fileName);
        if (!await fs.exists(fullFilePath)) {
          throw new Error(`File '${appName}/${fileName}' does not exist`);
        }

        return this.utilService.convertYamlToJson((await fs.readFile(fullFilePath)).toString());
    }

    /**
     * get the app environments
     * @param repoPath the repository path
     * @param appName the app name
     */
    async getEnvironments(repoPath: string, appName: string) {
        const { fs } = await getGitFS();
        const fullFilePath = path.resolve(repoPath, percyConfig.yamlAppsFolder, appName, percyConfig.environmentsFile);

        if (!await fs.exists(fullFilePath)) {
          console.warn(`App environments file '${fullFilePath}' does not exist`);
          return [];
        }
      
        const loaded = yamlJS.load((await fs.readFile(fullFilePath)).toString());
        return loaded.default;
    }

    /**
     * Commits the files
     * @param repoName the repository name
     * @param branchName the branch name
     * @param configFiles the config files to commit
     * @param message the commit message
     */
    commitFiles(repoName: string, branchName: string, configFiles: ConfigFile[], message: string): Observable<any> {
        const files = configFiles.map(file => ({
          ..._.pick(file, ['fileName', 'applicationName', 'timestamp']),
          fileContent: file.draftConfig
        }));
        const body = { message, files };
        return this.httpHelperService.post(
            `/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}/commit`, body);
    }

    /**
     * deletes the file within the given location from the repository
     * @param repoName the repository name
     * @param branchName the branch name
     * @param appName the app name
     * @param fileName the file name
     */
    deleteFile(repoName: string, branchName: string, appName: string, fileName: string): Observable<any> {
      let url = `/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}`;
      url = `${url}/applications/${encodeURIComponent(appName)}/files/${encodeURIComponent(fileName)}`;
      return this.httpHelperService.delete(url);
    }
}
