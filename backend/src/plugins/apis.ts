/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the api routes.
 *
 * @author TCSCODER
 * @version 1.0
 */
export default [
  {
    method: 'POST',
    path: '/log',
    controller: 'MaintenanceController',
    function: 'log',
  },
  {
    method: 'GET',
    path: '/healthcheck',
    controller: 'MaintenanceController',
    function: 'healthcheck',
  },
  {
    method: 'POST',
    path: '/refreshConfiguration',
    controller: 'MaintenanceController',
    function: 'refreshConfiguration',
  },
  {
    method: 'GET',
    path: '/userTypeAhead',
    controller: 'MaintenanceController',
    function: 'getUserTypeAhead',
  },
  {
    method: 'GET',
    path: '/defaultRepo',
    controller: 'MaintenanceController',
    function: 'defaultRepo',
  },
  {
    method: 'POST',
    path: '/accessRepo',
    controller: 'FileManagementController',
    function: 'accessRepo',
  },
  {
    method: 'GET',
    path: '/repos/{repoName}/branches/{branchName}/applications',
    controller: 'FileManagementController',
    function: 'listApplications',
    auth: true,
  },
  {
    method: 'GET',
    path: '/repos/{repoName}/branches/{branchName}/applications/{appName}/environments',
    controller: 'FileManagementController',
    function: 'getEnvironments',
    auth: true,
  },
  {
    method: 'GET',
    path: '/repos/{repoName}/branches/{branchName}/files',
    controller: 'FileManagementController',
    function: 'listFiles',
    auth: true,
  },
  {
    method: 'GET',
    path: '/repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}',
    controller: 'FileManagementController',
    function: 'getFile',
    auth: true,
  },
  {
    method: 'DELETE',
    path: '/repos/{repoName}/branches/{branchName}/applications/{appName}/files/{fileName}',
    controller: 'FileManagementController',
    function: 'deleteFile',
    auth: true,
  },
  {
    method: 'POST',
    path: '/repos/{repoName}/branches/{branchName}/commit',
    controller: 'FileManagementController',
    function: 'commitFiles',
    auth: true,
  },
];
