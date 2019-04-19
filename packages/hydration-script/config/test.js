/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
=========================================================================== 
*/

module.exports = {
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "info",
  ENVIRONMENT_FILE_NAME:
    process.env.TEST_ENVIRONMENT_FILE_NAME || "environments.yaml",
  PERCY_CONFIG_FILE_NAME: process.env.TEST_PERCY_CONFIG_FILE_NAME || ".percyrc",
  PERCY_ENV_VARIABLE_NAME: process.env.TEST_PERCY_ENV_VARIABLE_NAME || "env",
  PERCY_ENV_IGNORE_PREFIX: process.env.PERCY_ENV_IGNORE_PREFIX || "_",
  PERCY_ENV_IGNORE_SUFFIX: process.env.PERCY_ENV_IGNORE_SUFFIX || "_",
  DEFAULT_PERCY_CONFIG: {
    variablePrefix: process.env.TEST_DEFAULT_VARIABLE_PREFIX || "_{",
    variableSuffix: process.env.TEST_DEFAULT_VARIABLE_SUFFIX || "}_",
    variableNamePrefix: process.env.TEST_DEFAULT_VARIABLE_NAME_PREFIX || "$"
  },
  COLORIZE_CONSOLE: process.env.COLORIZE_CONSOLE
    ? /(f(?:alse)?|0|off)/gi.test(process.env.COLORIZE_CONSOLE)
      ? false
      : true
    : true
};
