import * as BrowserFS from 'browserfs';
import * as Git from 'isomorphic-git';
import * as legacy from 'graceful-fs/legacy-streams';
import * as FsExtra from 'fs-extra/index';

import { percyConfig } from 'config';

// BrowserFS miss ReadStream/WriteStream, patch them
const bfs = BrowserFS.BFSRequire('fs');
const streams = legacy(bfs);
bfs['ReadStream'] = streams.ReadStream;
bfs['WriteStream'] = streams.WriteStream;

// Patch fs with fs-extra
const fsExtra = require('fs-extra');

// For readFile/writeFile/appendFile, fs-extra has problem with BrowserFS
// when passing null options
// (Here we don't care callback because we'll always use promise)
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
const patchSynchronousFS = (synFileSystem, func) => {
  const existFunc = synFileSystem[func];

  synFileSystem[func] = (...args) => {
    const callback = args[args.length - 1];

    args[args.length - 1] = (error, result) => {
      // Use setImmediate to join the zone.js promise
      setImmediate(() => callback(error, result));
    };

    existFunc.apply(synFileSystem, args);
  }
}

export const git = { ...Git };
export type FSExtra = typeof FsExtra;

const initBrowserFS = new Promise<FSExtra>((resolve, reject) => {
  
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

      // Root FS of AsyncMirror is a synchronous InMemory FS, patch it
      const rootFS = bfs.getRootFS();
      const methods = ['rename', 'stat', 'exists', 'open', 'unlink', 'rmdir', 'mkdir', 'readdir'];
      methods.forEach(m => {
        patchSynchronousFS(rootFS, m);
      });

      git.plugins.set('fs', bfs);

      await fsExtra.ensureDir(percyConfig.reposFolder);
      await fsExtra.ensureDir(percyConfig.draftFolder);
      await fsExtra.ensureDir(percyConfig.metaFolder);

      console.info('Browser Git initialized');
      resolve(fsExtra);
    }
  );
});

export async function getBrowserFS() {
  return await initBrowserFS;
}
