import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from '../../store';
import { UtilService } from '../../services/util.service';
import { ResolveConficts, GetFileContentSuccess, CommitChanges } from '../../store/actions/backend.actions';
import { ConfigFile } from '../../models/config-file';

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
      file.repoCode = this.utilService.convertJsonToYaml(file.config);

      const draftFile = _.find(this.data.draftFiles, _.pick(file, ['fileName', 'applicationName']));
      file.draftConf = draftFile['config'];
      file.draftCode = this.utilService.convertJsonToYaml(file.draftConf);
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

    const toRecommit = [];

    // Resovel conflict files
    const files = this.data.conflictFiles.map(file => {
      const result: ConfigFile = {
        fileName: file.fileName,
        applicationName: file.applicationName,
        timestamp: file.timestamp,
        size: file.size,
        config: file.resolveStrategy === 'draft' ? file.draftConf : file.config,
        originalConfig: file.config,
      };

      result.modified = !_.isEqual(result.config, result.originalConfig);

      if (result.modified) {
        toRecommit.push(result);
      }
      return result;
    });

    // Filter the unconlict draft file(s)
    this.data.draftFiles.forEach(draftFile => {
      if (!_.find(this.data.conflictFiles, _.pick(draftFile, ['applicationName', 'fileName']))) {
        toRecommit.push(draftFile);
      }
    });

    this.store.dispatch(new ResolveConficts(files));

    if (this.data.fromEditor && this.data.conflictFiles[0].resolveStrategy === 'repo') {
      this.store.dispatch(new GetFileContentSuccess({file: files[0]}));
    }

    if (toRecommit.length) {
      this.store.dispatch(new CommitChanges({
        files: toRecommit.map(f => _.omit(f, 'timestamp')), // Recommit without timestamp to bypass optimistic check
        message: this.data.commitMessage,
        fromEditor: this.data.fromEditor
      }));
    }
    this.dialogRef.close(true);
  }
}
