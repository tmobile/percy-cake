/**
 *   Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

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
  /**
   * handles the close action
   */
  close() {
    this.dialogRef.close(this.data);
  }
}
