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
