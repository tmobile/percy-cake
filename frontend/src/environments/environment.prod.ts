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
  draftFolder: '/percy-draft',
  metaFolder: '/percy-meta',
  yamlAppsFolder: 'apps',
  environmentsFile: 'environments.yaml',
  jwtSecret: '&**TD@FN4_Djd23',
  jwtExpiresIn: '12h',
  encryptKey: '&Ddf23&*Dksd',
  encryptSalt: '23E80(9Dls6$s',
  loggedInUsersMetaFile: 'logged-in-users.json',
  variableSubstitute: {
    prefix: '_{',
    suffix: '}_'
  }
}