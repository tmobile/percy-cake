import { Component, OnInit, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import * as _ from 'lodash';

import { percyConfig } from 'config';
import { TrimPattern } from 'services/validators';
import { FileManagementService } from 'services/file-management.service';

/**
 * The branches dialog component
 */
@Component({
  selector: 'app-branches-dialog',
  templateUrl: './branches-dialog.component.html',
  styleUrls: ['./branches-dialog.component.scss']
})
export class BranchesDialogComponent implements OnInit {

  currentBranchName: string;

  branchName = new FormControl('');
  newBranchName = new FormControl('', [TrimPattern('^[a-zA-Z0-9_-]*$'), Validators.maxLength(30)]);

  branches: string[];

  actionType = 'switch';

  /**
   * creates the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param store the state store instance
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<BranchesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data,
    public filService: FileManagementService) { }

  /**
   * initializes the component
   */
  async ngOnInit() {
    this.actionTypeChange();
    this.currentBranchName = this.data.principal.user.branchName;
    this.branchName.setValue(this.data.principal.user.branchName);
    this.branches = await this.filService.listBranches(this.data.principal);
  }

  /**
   * Listener when action type changes: switch branch or create a new one.
   */
  actionTypeChange() {
    if (this.actionType === 'switch') {
      this.branchName.enable();
      this.newBranchName.disable();
    } else {
      this.branchName.disable();
      this.newBranchName.enable();
    }
  }

  /**
   * Checkout.
   */
  checkout() {
    if (this.actionType === 'switch') {
      this.doCheckout(this.branchName.value);
    } else {
      if (!this.newBranchName.valid) {
        return;
      }

      const newBranch = _.trim(this.newBranchName.value);
      if (this.branches.indexOf(newBranch) >= 0) {
        this.newBranchName.setErrors({ duplicate: true });
        return;
      }
      if (percyConfig.lockedBranches.indexOf(newBranch) >= 0) {
        this.newBranchName.setErrors({ locked: true });
        return;
      }
      this.doCheckout(newBranch);
    }
  }

  /**
   * Do checkout.
   * @param branch the branch name
   */
  private doCheckout(branch: string) {
    if (branch === this.currentBranchName) {
      this.dialogRef.close();
    } else {
      this.dialogRef.close({
        type: this.actionType,
        branch
      });
    }
  }
}
