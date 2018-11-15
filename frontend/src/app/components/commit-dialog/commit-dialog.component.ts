import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { FormControl, Validators } from '@angular/forms';
import * as _ from 'lodash';
/**
 * The confirm dialog component
 */
@Component({
  selector: 'app-commit-dialog',
  templateUrl: './commit-dialog.component.html',
  styleUrls: ['./commit-dialog.component.scss']
})
export class CommitDialogComponent {

  comment: FormControl = new FormControl('', [Validators.required]);

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<CommitDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data) { }

  /**
   * handles the commit action
   */
  commit() {
    const message = _.trim(this.comment.value);
    if (!message) {
      return;
    }
    this.dialogRef.close(message);
  }
}
