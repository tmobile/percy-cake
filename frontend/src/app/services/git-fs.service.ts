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

// BrowserFS synchronous file system (like InMemory) has issue
// to bypass zone.js promise handling
const patchSynchronousMethod = (synFileSystem, func) => {
  const existFunc = synFileSystem[func];

  synFileSystem[func] = (...args) => {
    const callback = args[args.length - 1];

    args[args.length - 1] = (error, result) => {
      // Use setImmediate to join the zone.js promise
      if (error) {
        setImmediate(() => callback(error));
      } else {
        setImmediate(() => callback(null, result));
      }
    };

    existFunc.apply(synFileSystem, args);
  }
}

export type GIT = typeof Git;
export type FSExtra = typeof FsExtra;

const initializer = new Promise<[GIT, FSExtra]>((resolve, reject) => {
  
  BrowserFS.configure(
    // For InMemory only repo folder, page refersh will be slow (since it needs fetch from remote),
    // other than that, it's good
    // {
    //   fs: 'MountableFileSystem', options: {
    //     [percyConfig.reposFolder]: { fs: 'InMemory' },
    //     [percyConfig.metaFolder]: { fs: 'IndexedDB', options: {storeName: percyConfig.storeName} },
    //     [percyConfig.draftFolder]: { fs: 'IndexedDB', options: {storeName: percyConfig.storeName} }
    //   }
    // },

    {
      fs: "AsyncMirror",
      options: {
        sync: { fs: "InMemory" },
        async: { fs: "IndexedDB", options: {storeName: percyConfig.storeName} }
      },
    },
    async function (err) {
      if (err) {
        console.error(err);
        return reject(err);
      };

      const rootFS = fs.getRootFS();
      const synMethods = ['rename', 'stat', 'exists', 'open', 'unlink', 'rmdir', 'mkdir', 'readdir'];
      synMethods.forEach(m => {
        patchSynchronousMethod(rootFS, m);
      });

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
