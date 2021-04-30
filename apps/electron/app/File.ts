/**
=========================================================================
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
import { Configuration, FileTypes } from "../../webapp/src/app/models/config-file";
export { FileTypes } from "../../webapp/src/app/models/config-file";

export class File {
  ino: number;
  applicationName: string;

  editMode = true;
  envFileMode = false;
  modified = false;

  expanded: boolean;

  environments: string[];
  originalConfig: Configuration;
  configuration: Configuration;
  originalContent: string;

  folderPopulated = false;
  children: File[] = [];

  constructor(
    public path: string,
    public fileName: string,
    public isFile: boolean,
    public parent: File,
    public fileType?: FileTypes
  ) {}

  addChild(child: File): void {
    this.children.push(child);
    child.parent = this;
  }

  hasChild(childPath: string): boolean {
    for (const child of this.children) {
      if (child.path === childPath) {
        return true;
      }
    }
    return false;
  }
  removeChild(childPath: string): void {
    this.children = this.children.filter(c => c.path !== childPath);
  }
}

