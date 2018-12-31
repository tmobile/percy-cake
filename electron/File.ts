export class File {
  fileName: string;
  applicationName: string;
  ino: number;

  editMode = true;
  envFileMode = false;
  modified = false;

  expanded: boolean;

  environments: string[];
  originalConfig: any;
  configuration: any;

  parent: File;
  children: File[] = [];

  constructor(public path: string, public isFile: boolean) {
  }

  addChild(child: File) {
    this.children.push(child);
    child.parent = this;
  }
}
