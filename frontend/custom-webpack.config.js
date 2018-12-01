const webpack = require('webpack');

module.exports = {
  resolve: {
    // Use our versions of Node modules.
    alias: {
      'fs': 'browserfs/dist/shims/fs.js',
      'buffer': 'browserfs/dist/shims/buffer.js',
      'path': 'browserfs/dist/shims/path.js',
      'processGlobal': 'browserfs/dist/shims/process.js',
      'bufferGlobal': 'browserfs/dist/shims/bufferGlobal.js',
      'bfsGlobal': require.resolve('browserfs'),
    }
  },
  // REQUIRED to avoid issue "Uncaught TypeError: BrowserFS.BFSRequire is not a function"
  // See: https://github.com/jvilk/BrowserFS/issues/201
  module: {
    noParse: /browserfs\.js/,
  },
  plugins: [
    // Expose BrowserFS, process, and Buffer globals.
    // NOTE: If you intend to use BrowserFS in a script tag, you do not need
    // to expose a BrowserFS global.
    new webpack.ProvidePlugin({
      BrowserFS: 'bfsGlobal',
      process: 'processGlobal',
      Buffer: 'bufferGlobal'
    }),
    new webpack.EnvironmentPlugin({
      CORS_PROXY: '/isogit-proxy',
      DEFAULT_BRANCH_NAME: 'admin',
      DEFAULT_REPOSITORY_URL: '',
      LOCKED_BRANCHES: '["master","trunk"]',
      STORE_NAME: 'PercyGitRepo',
      REPOS_FOLDER: '/percy-repo',
      DRAFT_FOLDER: '/percy-draft',
      META_FOLDER: '/percy-meta',
      REPO_METADATA_VERSION: '',
      LOGGED_IN_USERS_METAFILE: 'logged-in-users.json',
      YAML_APPS_FOLDER: 'apps',
      ENVIRONMENTS_FILE: 'environments.yaml',
      PULL_TIMEOUT: '30s',
      LOGIN_SESSION_TIMEOUT: '1h',
      ENCRYPT_KEY: '&Ddf23&*Dksd',
      ENCRYPT_SALT: '23E80(9Dls6$s',
      VARIABLE_SUBSTITUTE_PREFIX: '_{',
      VARIABLE_SUBSTITUTE_SUFFIX: '}_'
    })
  ],
  // DISABLE Webpack's built-in process and Buffer polyfills!
  node: {
    process: false,
    Buffer: false,
  }
};
