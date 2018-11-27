import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from 'store';
import { UtilService } from 'services/util.service';
import { GetFileContentSuccess, CommitChanges } from 'store/actions/backend.actions';
import { ConfigFile } from 'models/config-file';

/**
 * The conflict dialog component
 */
@Component({
  selector: 'app-conflict-dialog',
  templateUrl: './conflict-dialog.component.html',
  styleUrls: ['./conflict-dialog.component.scss']
})
export class ConflictDialogComponent implements OnInit {

  fileIdx = 0;

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<ConflictDialogComponent>,
    private utilService: UtilService,
    private store: Store<appStore.AppState>,
    @Inject(MAT_DIALOG_DATA) public data) {
      dialogRef.disableClose = true;
  }

  ngOnInit() {
    this.data.conflictFiles.forEach(file => {
      file.repoCode = this.utilService.convertJsonToYaml(file.originalConfig);

      const draftFile: any = _.find(this.data.draftFiles, _.pick(file, ['fileName', 'applicationName']));
      file.draftConfig = draftFile.draftConfig;
      file.draftCode = this.utilService.convertJsonToYaml(file.draftConfig);
    });
  }

  setFileIdx(_fileIdx) {
    this.fileIdx = _fileIdx;
  }

  resolveConflict($event, file) {
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
    const files = this.data.conflictFiles.map(file => {
      const result: ConfigFile = {
        fileName: file.fileName,
        applicationName: file.applicationName,
        size: file.size,
        draftConfig: file.resolveStrategy === 'draft' ? file.draftConfig : file.originalConfig,
        originalConfig: file.originalConfig,
      };

      return result;
    });

    // Add back the unconlict draft file(s)
    this.data.draftFiles.forEach(draftFile => {
      if (!_.find(this.data.conflictFiles, _.pick(draftFile, ['applicationName', 'fileName']))) {
        files.push(draftFile);
      }
    });

    this.store.dispatch(new CommitChanges({
      files,
      message: this.data.commitMessage,
      fromEditor: this.data.fromEditor,
      resolveConflicts: true,
    }));

    this.dialogRef.close(true);
  }
}
