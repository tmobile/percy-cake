import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';
import { FormControl } from '@angular/forms';
import * as _ from 'lodash';

import { NotEmpty } from 'services/util.service';

/**
 * The commit dialog component
 */
@Component({
  selector: 'app-commit-dialog',
  templateUrl: './commit-dialog.component.html',
  styleUrls: ['./commit-dialog.component.scss']
})
export class CommitDialogComponent {

  comment: FormControl = new FormControl('', [NotEmpty]);

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   */
  constructor(public dialogRef: MatDialogRef<CommitDialogComponent>) { }

  /**
   * handles the commit action
   */
  commit() {
    if (!this.comment.valid) {
      return;
    }
    this.dialogRef.close(_.trim(this.comment.value));
  }
}
