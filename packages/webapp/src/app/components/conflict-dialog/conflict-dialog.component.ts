import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import * as _ from 'lodash';

import { ConfigFile, ConflictFile } from 'models/config-file';

/**
 * The conflict dialog component
 */
@Component({
  selector: 'app-conflict-dialog',
  templateUrl: './conflict-dialog.component.html',
  styleUrls: ['./conflict-dialog.component.scss']
})
export class ConflictDialogComponent {

  fileIdx = 0;

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<ConflictDialogComponent>,
    // private yamlService: YamlService,
    @Inject(MAT_DIALOG_DATA) public data) {
    dialogRef.disableClose = true;
    data.conflictFiles = data.conflictFiles.sort((a, b) => {
      if (a.applicationName < b.applicationName) {
        return -1;
      } else if (a.applicationName > b.applicationName) {
        return 1;
      } else if (a.fileName < b.fileName) {
        return -1;
      } else if (a.fileName > b.fileName) {
        return 1;
      } else {
        return 0;
      }
    });
  }

  setFileIdx(_fileIdx: number) {
    this.fileIdx = _fileIdx;
  }

  resolveConflict($event, file: ConflictFile) {
    file.resolveStrategy = $event.value;
  }

  allResolved() {
    return !_.filter(this.data.conflictFiles, f => !f.resolveStrategy).length;
  }

  /**
   * handles the confirm action
   */
  confirmAction() {

    // Convert conflict files
    const files = this.data.conflictFiles.map((file: ConflictFile) => {
      const result: ConfigFile = {
        fileName: file.fileName,
        applicationName: file.applicationName,
        size: file.size,
        draftContent: file.resolveStrategy === 'draft' ? file.draftContent : file.originalContent,
        originalContent: file.originalContent,
        draftConfig: file.resolveStrategy === 'draft' ? file.draftConfig : file.originalConfig,
        originalConfig: file.originalConfig,
      };

      return result;
    });


    this.dialogRef.close(files);
  }
}
