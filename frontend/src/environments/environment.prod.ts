export const environment = {
  production: true,
};

export const percyConfig = {
  corsProxy: process.env.CORS_PROXY || '/isogit-proxy',
  defaultBranchName: process.env.DEFAULT_BRANCH_NAME || 'admin',
  defaultRepositoryUrl: process.env.DEFAULT_REPOSITORY_URL || '',
  lockedBranches: JSON.parse(process.env.LOCKED_BRANCHES) || ['master', 'trunk'],
  storeName: process.env.STORE_NAME || 'PercyGitRepo',
  reposFolder: process.env.REPOS_FOLDER || '/percy-repo',
  draftFolder: process.env.DRAFT_FOLDER || '/percy-draft',
  metaFolder: process.env.META_FOLDER || '/percy-meta',
  repoMetadataVersion: process.env.REPO_METADATA_VERSION || '2.0',
  loggedInUsersMetaFile: process.env.LOGGED_IN_USERS_METAFILE || 'logged-in-users.json',
  yamlAppsFolder: process.env.YAML_APPS_FOLDER || 'apps',
  environmentsFile: process.env.ENVIRONMENTS_FILE || 'environments.yaml',
  pullTimeout: process.env.PULL_TIMEOUT || '30s',
  loginSessionTimeout: process.env.LOGIN_SESSION_TIMEOUT || '1h',
  encryptKey: process.env.ENCRYPT_KEY || '&Ddf23&*Dksd',
  encryptSalt: process.env.ENCRYPT_SALT || '23E80(9Dls6$s',
  variableSubstitutePrefix: process.env.VARIABLE_SUBSTITUTE_PREFIX || '_{',
  variableSubstituteSuffix: process.env.VARIABLE_SUBSTITUTE_SUFFIX || '}_',
}