import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import * as appStore from 'store';
import { Store } from '@ngrx/store';
import { AlertClosed } from 'store/actions/common.actions';

/**
 * The alert dialog component
 */
@Component({
  selector: 'app-alert-dialog',
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.scss']
})
export class AlertDialogComponent implements OnInit {

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param store the state store instance
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<AlertDialogComponent>,
    private store: Store<appStore.AppState>,
    @Inject(MAT_DIALOG_DATA) public data) { }

  ngOnInit() {
    this.dialogRef.afterClosed().subscribe(() => this.store.dispatch(new AlertClosed(this.data)));
  }
}
