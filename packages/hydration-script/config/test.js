/**
 *    Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

module.exports = {
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || 'info',
  ENVIRONMENT_FILE_NAME: process.env.TEST_ENVIRONMENT_FILE_NAME || "environments.yaml",
  PERCY_CONFIG_FILE_NAME: process.env.TEST_PERCY_CONFIG_FILE_NAME || ".percyrc",
  DEFAULT_PERCY_CONFIG: {
    variablePrefix: process.env.TEST_DEFAULT_VARIABLE_PREFIX || "_{",
    variableSuffix: process.env.TEST_DEFAULT_VARIABLE_SUFFIX || "}_",
    variableNamePrefix: process.env.TEST_DEFAULT_VARIABLE_NAME_PREFIX || "$",
  }
};
