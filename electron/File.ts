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
    if (parent) {
      parent.children.push(this);
    }
    File.setId(this);
  }
}
