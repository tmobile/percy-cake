import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';

/**
 * The confirm dialog component
 */
@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss']
})
export class ConfirmationDialogComponent {

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<ConfirmationDialogComponent>) { }

  /**
   * handles the confirm action
   */
  confirmAction() {
    this.dialogRef.close(true);
  }
}
