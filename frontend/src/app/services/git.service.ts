import * as BrowserFS from 'browserfs';
import * as Git from 'isomorphic-git';

import * as fs from 'mz/fs';

import { percyConfig } from '../config';

const initializer = new Promise<typeof Git>((resolve, reject) => {

  BrowserFS.configure(
    // {
    //   fs: 'AsyncMirror',
    //   options: {
    //     sync: { fs: 'InMemory' },
    //     async: { fs: 'IndexedDB', options: { storeName: percyConfig.storeName } }
    //   }
    // },
    {
      fs: 'IndexedDB', options: { storeName: percyConfig.storeName }
    },
    async function (err) {
      if (err) {
        console.error(err);
        return reject(err);
      };

      Git.plugins.set('fs', BrowserFS.BFSRequire('fs'));

      if (!await fs.exists(percyConfig.reposFolder)) {
        await fs.mkdir(percyConfig.reposFolder);
      }
      if (!await fs.exists(percyConfig.metaFolder)) {
        await fs.mkdir(percyConfig.metaFolder);
      }

      console.info('Browser Git initialized');
      resolve(Git);
    }
  );
});

export async function getGitFS() {
  const git = await initializer;
  return { fs, git };
}

// @Injectable ({ providedIn: 'root' })
// export class GitService {

//   /**
//    * initializes the service
//    */
//   constructor() {
//   }

//   async log(dir, depth) {
//     const git = await initializer;
//     return git.log({dir, depth});
//   }

//   async undoLast(dir, branch, commit) {
//     const git = await initializer;
//     const commits = await git.log({dir, depth: 2});
//     if (commits.length < 2) {
//       return;
//     }
//     await fs.writeFile(`${dir}/.git/refs/heads/${branch}`, commits.pop().oid);
//     await fs.unlink(`${dir}/.git/index`);
//     await git.checkout({ dir, ref: branch });
//   }
// }

// let currentCommit = await git.resolveRef({ dir: repoPath, ref: branchName })
// console.log(currentCommit)
// let object = await git.readObject({
//   dir: repoPath,
//   oid: currentCommit,
//   format: 'deflated',
//   filepath: 'README.md',
// })
// console.log(object.oid)
// console.info(`Pulled repo: ${repoPath}`);