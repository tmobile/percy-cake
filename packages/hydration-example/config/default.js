module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENVIRONMENT_FILE_NAME: process.env.ENVIRONMENT_FILE_NAME || "environments.yaml",
  PERCY_CONFIG_FILE_NAME: process.env.PERCY_CONFIG_FILE_NAME || ".percyrc",
  DEFAULT_PERCY_CONFIG: {
    variablePrefix: process.env.DEFAULT_VARIABLE_PREFIX || "_{",
    variableSuffix: process.env.DEFAULT_VARIABLE_SUFFIX || "}_",
    variableNamePrefix: process.env.DEFAULT_VARIABLE_NAME_PREFIX || "$",
  }

};
