import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatAutocompleteTrigger } from '@angular/material';
import { FormControl, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import * as _ from 'lodash';

/**
 * The select app dialog component
 */
@Component({
  selector: 'app-select-dialog',
  templateUrl: './select-app-dialog.component.html',
  styleUrls: ['./select-app-dialog.component.scss']
})
export class SelectAppDialogComponent implements OnInit {

  appname = new FormControl('', [Validators.required]);
  createEnv = new FormControl();

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
    const { selectedApp } = this.data;
    if (selectedApp) {
      this.appname.setValue(selectedApp);
      this.onAppChange(selectedApp);
    }

    this.filteredApps = this.appname.valueChanges
      .pipe(
        startWith(selectedApp || ''),
        debounceTime(100),
        distinctUntilChanged(),
        map(value => {
          value = _.trim(value);

          this.onAppChange(value);

          if (!value || _.includes(this.data.applications, value)) {
            return this.data.applications;
          }

          return this.data.applications.filter(option => _.includes(option.toLowerCase(), value));
        })
      );
  }

  private onAppChange(app) {
    const result = _.find(this.data.files, {fileName: this.data.envFileName, applicationName: app});
    if (result) {
      // Env file already exists
      this.createEnv.disable();
      this.createEnv.setValue(false);
    } else {
      this.createEnv.enable();
    }
  }

  /**
   * handles the select app action
   */
  selectApp() {
    const appName = _.trim(this.appname.value);
    if (!appName) {
      return;
    }
    this.dialogRef.close({appName, createEnv: this.createEnv.value});
  }
}
