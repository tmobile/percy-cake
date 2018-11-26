import * as BrowserFS from 'browserfs';
import * as Git from 'isomorphic-git';
import * as legacy from 'graceful-fs/legacy-streams';
import * as FsExtra from 'fs-extra/index';

import { percyConfig } from 'config';

// BrowserFS miss ReadStream/WriteStream, patch them
const fs = BrowserFS.BFSRequire('fs');
const streams = legacy(fs);
fs['ReadStream'] = streams.ReadStream;
fs['WriteStream'] = streams.WriteStream;

// Patch fs with fs-extra
const fsExtra = require('fs-extra');

// For readFile/writeFile/appendFile, fs-extra has problem with BrowserFS
// when passing null options
// (Here we don't care callback because we'll use always promise)
const fs$readFile = fsExtra.readFile;
fsExtra.readFile = function (path, options) {
  return fs$readFile(path, options || {});
};

const fs$writeFile = fsExtra.writeFile;
fsExtra.writeFile = function (path, data, options) {
  return fs$writeFile(path, data, options || {});
};

const fs$appendFile = fsExtra.appendFile;
fsExtra.appendFile = function (path, data, options) {
  return fs$appendFile(path, data, options || {});
};

export type GIT = typeof Git;
export type FSExtra = typeof FsExtra;

const initializer = new Promise<[GIT, FSExtra]>((resolve, reject) => {

  BrowserFS.configure(
    {
      fs: 'IndexedDB', options: { storeName: percyConfig.storeName }
    },
    async function (err) {
      if (err) {
        console.error(err);
        return reject(err);
      };

      Git.plugins.set('fs', fs);

      if (!await fsExtra.exists(percyConfig.reposFolder)) {
        await fsExtra.ensureDir(percyConfig.reposFolder);
      }
      if (!await fsExtra.exists(percyConfig.draftFolder)) {
        await fsExtra.ensureDir(percyConfig.draftFolder);
      }
      if (!await fsExtra.exists(percyConfig.metaFolder)) {
        await fsExtra.ensureDir(percyConfig.metaFolder);
      }

      console.info('Browser Git initialized');
      resolve([Git, fsExtra]);
    }
  );
});

export async function getGitFS() {
  const [git, fs] = await initializer;
  return { git, fs };
}
