import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteTrigger } from '@angular/material';
import { FormControl, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import * as _ from 'lodash';
/**
 * The confirm dialog component
 */
@Component({
  selector: 'app-select-dialog',
  templateUrl: './select-app-dialog.component.html',
  styleUrls: ['./select-app-dialog.component.scss']
})
export class SelectAppDialogComponent implements OnInit {

  appname: FormControl = new FormControl('', [Validators.required]);
  createEnv: boolean;

  filteredApps: Observable<string[]>;
  @ViewChild('trigger') trigger: MatAutocompleteTrigger;

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(public dialogRef: MatDialogRef<SelectAppDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data) { }

  ngOnInit() {
    if (this.data.selectedApp) {
      this.appname.setValue(this.data.selectedApp);
    }
    this.filteredApps = this.appname.valueChanges
      .pipe(
        startWith(null),
        debounceTime(100),
        distinctUntilChanged(),
        switchMap(value => {
          value = _.trim(value);
          if (!value || _.includes(this.data.applications, value)) {
            return of(this.data.applications);
          }
          return of(this.data.applications.filter(option => _.includes(option.toLowerCase(), value)));
        })
      );
  }

  triggerOpen() {
    this.trigger.openPanel();
  }

  canCreateEnv() {
    const result = this.data.canCreateEnv(_.trim(this.appname.value));
    if (!result) {
      this.createEnv = false;
    }
    return result;
  }

  /**
   * handles the select app action
   */
  selectApp() {
    const appName = _.trim(this.appname.value);
    if (!appName) {
      return;
    }
    this.dialogRef.close({appName, createEnv: this.createEnv});
  }
}
