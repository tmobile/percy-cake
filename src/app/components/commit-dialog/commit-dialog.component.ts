import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';
import { FormControl, Validators } from '@angular/forms';
import * as _ from 'lodash';
/**
 * The commit dialog component
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
   */
  constructor(public dialogRef: MatDialogRef<CommitDialogComponent>) { }

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
