/**
 * This file defines the file management controller.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as Hapi from 'hapi';

import FileManagementService from '../services/FileManagementService';

/**
 * Access/clone remote repository and receive the security token to be used in subsequent requests.
 * @param request Hapi request
 * @returns Security token of repo
 */
export async function accessRepo(request: Hapi.Request) {
  const requestInfo = {
    userAgent: request.headers['user-agent'],
    ip: request.info.remoteAddress,
  };
  return await FileManagementService.accessRepo(request.payload, requestInfo);
}

/**
 * List application names in the repo.
 * @param request Hapi request
 * @returns application names in the repo
 */
export async function listApplications(request: Hapi.Request) {
  return await FileManagementService.listApplications(request.auth.credentials.user, request.params);
}

/**
 * Get environments in the repo app.
 * @param request Hapi request
 * @returns environments in the repo app
 */
export async function getEnvironments(request: Hapi.Request) {
  return await FileManagementService.getEnvironments(request.auth.credentials.user, request.params);
}

/**
 * List the yaml files in the repo.
 * @param request Hapi request
 * @returns yaml files in the repo
 */
export async function listFiles(request: Hapi.Request) {
  return await FileManagementService.listFiles(request.auth.credentials.user, request.params);
}

/**
 * Get the content of the file within the given location.
 * @param request Hapi request
 */
export async function getFile(request: Hapi.Request) {
  return await FileManagementService.getFile(request.auth.credentials.user, request.params);
}

/**
 * Commits the files to remote origin.
 * @param request Hapi request
 * @return files with updated timestamp and size
 */
export async function commitFiles(request: Hapi.Request) {
  return await FileManagementService.commitFiles(
    request.auth.credentials.user, request.params, request.payload);
}

/**
 * Delete the file within the given location from local and remote repos.
 * @param request Hapi request
 */
export async function deleteFile(request: Hapi.Request) {
  await FileManagementService.deleteFile(request.auth.credentials.user, request.params);
}
