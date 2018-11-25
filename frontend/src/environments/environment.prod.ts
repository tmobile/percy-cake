export const environment = {
  production: true,
  api: {
    baseUrl: '/api/1.0',
    corsProxy: 'http://localhost:9999'
  }
};

export const percyConfig = {
  storeName: 'PercyGitRepo',
  reposFolder: '/percy-repo',
  metaFolder: '/percy-meta',
  yamlAppsFolder: 'apps',
  environmentsFile: 'environments.yaml',
  encryptKey: '&Ddf23&*Dksd',
  encryptSalt: '23E80(9Dls6$s',
  loggedInUsersMetaFile: 'logged-in-users.json',
  variableSubstitute: {
    prefix: '_{',
    suffix: '}_'
  }
}