/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the maintenance controller.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as Hapi from 'hapi';

import MaintenanceService from '../services/MaintenanceService';

/**
 * Log error.
 * @param request Hapi request
 */
export async function log(request: Hapi.Request) {
  await MaintenanceService.log(request.payload);
}

/**
 * Get the health check information.
 * @returns health check information
 */
export async function healthcheck() {
  return await MaintenanceService.healthcheck();
}

/**
 * Reload the configuration from the provided config json file.
 * @param request Hapi request
 */
export async function refreshConfiguration(request: Hapi.Request) {
  await MaintenanceService.refreshConfiguration(request.payload);
}

/**
 * Gets the user type head
 * @param request the Hapi request
 */
export async function getUserTypeAhead(request: Hapi.Request) {
  return await MaintenanceService.getUserTypeAhead(request.query);
}

/**
 * Get default repo url and branch name.
 * @returns default repo url and branch name
 */
export async function defaultRepo() {
  return await MaintenanceService.defaultRepo();
}
