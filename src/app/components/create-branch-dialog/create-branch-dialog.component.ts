import { Component, OnInit, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { TrimPattern } from 'services/validators';

/**
 * Create new branch dialog
 */
@Component({
  selector: 'app-create-branch-dialog',
  templateUrl: './create-branch-dialog.component.html',
  styleUrls: ['./create-branch-dialog.component.scss']
})
export class CreateBranchDialogComponent implements OnInit {

  newBranchName = new FormControl('', [TrimPattern('^[a-zA-Z0-9_-]*$'), Validators.maxLength(30)]);

  /**
   * creates the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param store the state store instance
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<CreateBranchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data) { }

  ngOnInit() {
  }

  /**
   * create new branch
   */
  createBranch() {
    if (this.newBranchName.valid) {
      const { branches } = this.data;

      const newBranch = _.trim(this.newBranchName.value);
      if (branches.indexOf(newBranch) >= 0) {
        this.newBranchName.setErrors({ duplicate: true });
        return;
      }
      if (percyConfig.lockedBranches.indexOf(newBranch) >= 0) {
        this.newBranchName.setErrors({ locked: true });
        return;
      }
      this.dialogRef.close(newBranch);
    }
  }

}
