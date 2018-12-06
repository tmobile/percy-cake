/**
 * This represents a shimmed 'fs' object.
 * It implements almost all the methods of node.js builtin 'fs'.
 *
 * With help of webpack alias, this makes require('fs') work.
 *
 * @see custom-webpack-config.js
 */
import * as legacy from 'graceful-fs/legacy-streams';
import { FileSystem } from 'filer/src';
import * as Git from 'isomorphic-git';
import * as _ from 'lodash';

import { percyConfig } from 'config';

let filerFS; // The Filer fs implementation to delegat to

const git = { ...Git };

const ShimFS = {
  git,

  /**
   * Initialize the filesystem.
   */
  initialize: async () => {
    await new Promise<void>((resolve, reject) => {
      filerFS = new FileSystem({
        flags: ['NOCTIME', 'NOMTIME'], // We use file oid sha, don't need ctime/mtime
        provider: new FileSystem.providers.IndexedDB(percyConfig.storeName)
      }, (err) => {
        if (err) {
          console.error(err);
          return reject(err);
        }

        // Filer system will write file changes event to localstorage when context.close
        // We don't need that presently, shim context.close to be an empty method
        function shimContext(method) {
          const $method = filerFS.provider[method];
          filerFS.provider[method] = (...args) => {
            const context = $method.apply(filerFS, args);
            context.close = function () { };
            return context;
          };
        }

        shimContext('openReadWriteContext');
        shimContext('openReadOnlyContext');

        git.plugins.set('fs', <any>ShimFS);

        resolve();
      });
    });
  },

  /**
   * Check whether filesystem is initiliazed.
   * @returns true if filesystem is initiliazed, false otherwise
   */
  initialized: () => filerFS && filerFS.readyState === 'READY'
};

// Define all the fs methods
[
  'open',
  'access',
  'chmod',
  'fchmod',
  'chown',
  'fchown',
  'close',
  'mknod',
  'mkdir',
  'rmdir',
  'stat',
  'fstat',
  'fsync',
  'link',
  'unlink',
  'read',
  'readFile',
  'write',
  'writeFile',
  'appendFile',
  'exists',
  'lseek',
  'readdir',
  'rename',
  'readlink',
  'symlink',
  'lstat',
  'truncate',
  'ftruncate',
  'utimes',
  'futimes',
  'setxattr',
  'getxattr',
  'fsetxattr',
  'fgetxattr',
  'removexattr',
  'fremovexattr'
].forEach((key) => {
  ShimFS[key] = function (...args) {
    // For writeFile/appendFile, normalize the options arg with encoding and flag
    if (key === 'writeFile' && _.isEmpty(args[2])) {
      args[2] = {
        encoding: 'utf8',
        flag: 'w'
      };
    } else if (key === 'appendFile' && _.isEmpty(args[2])) {
      args[2] = {
        encoding: 'utf8',
        flag: 'a'
      };
    }

    // Delete to Filer implementation
    return filerFS[key].apply(filerFS, args);
  };
});

// Patch stream
const streams = legacy(ShimFS);
ShimFS['ReadStream'] = streams.ReadStream;
ShimFS['WriteStream'] = streams.WriteStream;

export = ShimFS;

const indexedDB = window.indexedDB ||
  window['mozIndexedDB'] ||
  window['webkitIndexedDB'] ||
  window['msIndexedDB'];

const indexedDBVersion = '2.0';
const $open = indexedDB.open;
indexedDB.open = (name) => {
  return $open.apply(indexedDB, [name, indexedDBVersion]);
};
