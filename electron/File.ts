export class File {
  applicationName: string;

  editMode = true;
  envFileMode = false;
  modified = false;

  expanded: boolean;

  environments: string[];
  originalConfig: any;
  configuration: any;

  children: File[] = [];

  id: string;

  static setId(file: File) {

    if (!file.isFile || (file.ino && file.ino > 0)) {
      file.id = file.path;
    } else {
      file.id = file.parent.path + '/' + file.fileName;
    }
  }

  constructor(public path: string, public fileName: string, public isFile: boolean, public ino: number, public parent: File) {
    File.setId(this);
  }

  addChild(child: File) {
    this.children.push(child);
    child.parent = this;
  }
}
