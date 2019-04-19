/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { Component, Inject, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { BehaviorSubject } from "rxjs";
import {
  startWith,
  debounceTime,
  distinctUntilChanged,
  map
} from "rxjs/operators";

import * as _ from "lodash";

import { NotEmpty } from "services/validators";

/**
 * The select app dialog component
 */
@Component({
  selector: "app-select-dialog",
  templateUrl: "./select-app-dialog.component.html",
  styleUrls: ["./select-app-dialog.component.scss"]
})
export class SelectAppDialogComponent implements OnInit {
  appname = new FormControl("", [NotEmpty]);
  createEnv = new FormControl();

  filteredApps = new BehaviorSubject<string[]>([]);

  /**
   * constructs the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param data the injection token that can be used to access the data that was passed in to a dialog
   */
  constructor(
    public dialogRef: MatDialogRef<SelectAppDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data
  ) {}

  /**
   * initializes the component
   */
  ngOnInit() {
    const { selectedApp } = this.data;
    if (selectedApp) {
      this.appname.setValue(selectedApp);
      this.onAppChange(selectedApp);
    }

    this.appname.valueChanges
      .pipe(
        startWith(selectedApp),
        map(value => {
          this.onAppChange(value);
          return value;
        }),
        debounceTime(100),
        distinctUntilChanged(),
        map(value => {
          value = _.trim(value);

          if (!value || _.includes(this.data.applications, value)) {
            return this.data.applications;
          }

          return this.data.applications.filter(option =>
            _.includes(option.toLowerCase(), value)
          );
        })
      )
      .subscribe(this.filteredApps);
  }

  /**
   * handles selected app changes event
   * @param app the newly selected app
   */
  private onAppChange(app) {
    const result = _.find(this.data.files, {
      fileName: this.data.envFileName,
      applicationName: app
    });
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
    this.dialogRef.close({ appName, createEnv: !!this.createEnv.value });
  }
}
