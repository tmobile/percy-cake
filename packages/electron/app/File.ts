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
