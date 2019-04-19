/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

/**
 * This represents a shimmed 'fs' object.
 * It implements almost all the methods of node.js builtin 'fs'.
 *
 * With help of webpack alias, this makes require('fs') work.
 *
 * @see custom-webpack.config.js
 */
import * as legacy from "graceful-fs/legacy-streams";
import { FileSystem } from "filer/src";
import * as Git from "isomorphic-git";
import * as uuid from "uuid/v4";
import * as _ from "lodash";

import { percyConfig } from "config";
import { CacheStorage } from "./storage";

let filerFS; // The Filer fs implementation to delegate to

const git = { ...Git };

const ShimFS = {
  git,

  /**
   * Initialize the filesystem.
   */
  initialize: async () => {
    await new Promise<void>((resolve, reject) => {
      filerFS = new FileSystem(
        {
          guid: uuid,
          flags: ["NOCTIME", "NOMTIME"], // We use file oid sha, don't need ctime/mtime
          provider: new CacheStorage(percyConfig.storeName)
        },
        err => {
          if (err) {
            console.error(err);
            return reject(err);
          }

          // Filer will write file changes events to localstorage when context.close
          // We don't need that feature presently, shim context.close to an empty method
          function shimContext(method) {
            const $method = filerFS.provider[method];
            filerFS.provider[method] = (...args) => {
              const context = $method.apply(filerFS, args);
              context.close = () => {};
              return context;
            };
          }

          shimContext("openReadWriteContext");
          shimContext("openReadOnlyContext");

          git.plugins.set("fs", <any>ShimFS);

          resolve();
        }
      );
    });
  },

  /**
   * Check whether filesystem is initiliazed.
   * @returns true if filesystem is initiliazed, false otherwise
   */
  initialized: () => filerFS && filerFS.readyState === "READY"
};

// Define all the fs methods
[
  "open",
  "access",
  "chmod",
  "fchmod",
  "chown",
  "fchown",
  "close",
  "mknod",
  "mkdir",
  "rmdir",
  "stat",
  "fstat",
  "fsync",
  "link",
  "unlink",
  "read",
  "readFile",
  "write",
  "writeFile",
  "appendFile",
  "exists",
  "lseek",
  "readdir",
  "rename",
  "readlink",
  "symlink",
  "lstat",
  "truncate",
  "ftruncate",
  "utimes",
  "futimes",
  "setxattr",
  "getxattr",
  "fsetxattr",
  "fgetxattr",
  "removexattr",
  "fremovexattr"
].forEach(key => {
  ShimFS[key] = function(...args) {
    // For writeFile/appendFile, normalize the options arg with encoding and flag
    if (key === "writeFile" && _.isEmpty(args[2])) {
      args[2] = {
        encoding: "utf8",
        flag: "w"
      };
    } else if (key === "appendFile" && _.isEmpty(args[2])) {
      args[2] = {
        encoding: "utf8",
        flag: "a"
      };
    }

    // Delete to Filer implementation
    return filerFS[key].apply(filerFS, args);
  };
});

// Patch stream
const streams = legacy(ShimFS);
ShimFS["ReadStream"] = streams.ReadStream;
ShimFS["WriteStream"] = streams.WriteStream;

export = ShimFS;
