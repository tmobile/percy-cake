import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as _ from 'lodash';

import { ConfigFile } from '../models/config-file';
import { HttpHelperService } from './http-helper.service';

/**
 * This service provides the methods around the file management API endpoints
 */
@Injectable({ providedIn: 'root' })
export class FileManagementService {

    /**
     * initializes the service
     * @param httpHelperService the http helper service
     */
    constructor(private httpHelperService: HttpHelperService) { }

    /**
     * access the repository and receives the security token to be used in subsequent requests
     * @param repositoryURL the repository URL
     * @param branchName the branch name
     * @param username the username
     * @param password the password
     */
    accessRepo(repositoryURL: string, branchName: string, username: string, password: string): Observable<any> {
        return this.httpHelperService.post('/accessRepo', { repoURL: repositoryURL, branchName, username, password });
    }

    /**
     * get files for a particular repository
     * @param repoName the repository name
     * @param branchName the branch name
     */
    getFiles(repoName: string, branchName: string): Observable<any> {
        return this.httpHelperService.get(`/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}/files`);
    }

    /**
     * list application for a particular repository
     * @param repoName the repository name
     * @param branchName the branch name
     */
    listApplications(repoName: string, branchName: string): Observable<any> {
        return this.httpHelperService.get(`/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}/applications`);
    }

    /**
     * get the app environments
     * @param repoName the repository name
     * @param branchName the branch name
     * @param appName the app name
     */
    getEnvironments(repoName: string, branchName: string, appName: string): Observable<Array<string>> {
        let url = `/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}`;
        url = `${url}/applications/${encodeURIComponent(appName)}/environments`;
        return this.httpHelperService.get(url);
    }

    /**
     * get file content of provided file path
     * @param repoName the repository name
     * @param branchName the branch name
     * @param appName the app name
     * @param fileName the file name
     */
    getFileContent(repoName: string, branchName: string, appName: string, fileName: string): Observable<any> {
        let url = `/repos/${encodeURIComponent(repoName)}/branches/${encodeURIComponent(branchName)}`;
        url = `${url}/applications/${encodeURIComponent(appName)}/files/${encodeURIComponent(fileName)}`;
        return this.httpHelperService.get(url);
    }

    /**
     * Commits the files
     * @param repoName the repository name
     * @param branchName the branch name
     * @param configFiles the config files to commit
     * @param message the commit message
     */
    commitFiles(repoName: string, branchName: string, configFiles: ConfigFile[], message: string): Observable<any> {
        const files = configFiles.map(file => ({..._.pick(file, ['fileName', 'applicationName', 'timestamp']), fileContent: file.config}));
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
