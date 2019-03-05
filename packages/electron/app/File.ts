/**
 *    Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

export class File {
  ino: number;
  applicationName: string;

  editMode = true;
  envFileMode = false;
  modified = false;

  expanded: boolean;

  environments: string[];
  originalConfig: any;
  configuration: any;

  folderPopulated = false;
  children: File[] = [];

  constructor(public path: string, public fileName: string, public isFile: boolean, public parent: File) {
  }

  addChild(child: File) {
    this.children.push(child);
    child.parent = this;
  }

  hasChild(childPath: string) {
    for (const child of this.children) {
      if (child.path === childPath) {
        return true;
      }
    }
    return false;
  }
  removeChild(childPath: string) {
    this.children = this.children.filter(c => c.path !== childPath);
  }
}
