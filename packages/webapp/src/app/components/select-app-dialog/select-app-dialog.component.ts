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

import { Component, Inject, OnInit, OnDestroy } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { Subscription } from "rxjs";

import * as _ from "lodash";

import { NotEmpty } from "services/validators";
import { FileTypes } from "models/config-file";
import { percyConfig } from "config";

/**
 * The select app dialog component
 */
@Component({
  selector: "app-select-dialog",
  templateUrl: "./select-app-dialog.component.html",
  styleUrls: ["./select-app-dialog.component.scss"]
})
export class SelectAppDialogComponent implements OnInit, OnDestroy {
  baseFolderOptions = ["", percyConfig.yamlAppsFolder, "application"];

  fileType = new FormControl(FileTypes.YAML);
  baseFolder = new FormControl(this.baseFolderOptions[0]);
  appname = new FormControl("", [NotEmpty]);
  createEnv = new FormControl();

  filteredApps = [];
  hasPercyrc = [];
  fileTypes = FileTypes;

  subscription = new Subscription();

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
    const { selectedApp, files, applications } = this.data;

    this.filteredApps = applications;
    this.hasPercyrc = _.map(_.filter(files, { fileName: ".percyrc"} ), "applicationName");

    const sub1 = this.appname.valueChanges
      .subscribe(value => this.onAppChange(value));

    const sub2 = this.fileType.valueChanges
      .subscribe(fileType => {
        if (this.appname.value !== "") {
          this.appname.setValue("");
        }

        if (fileType === FileTypes.PERCYRC) {
          this.baseFolderOptions = _.difference(["", percyConfig.yamlAppsFolder], this.hasPercyrc);
          this.baseFolderOptions.push("application");

          this.filteredApps = _.difference(applications, this.hasPercyrc);
        } else {
          this.baseFolderOptions = ["", percyConfig.yamlAppsFolder, "application"];
          this.filteredApps = applications;
        }

        this.baseFolder.setValue(this.baseFolderOptions[0]);
      });

    if (selectedApp) {
      this.appname.setValue(selectedApp);
    }

    this.subscription.add(sub1);
    this.subscription.add(sub2);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
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
    const fileType = this.fileType.value;
    const baseFolder = this.baseFolder.value;
    let appName = this.appname.value;

    if ((fileType === FileTypes.YAML || baseFolder === "application") && !appName) {
      return;
    }

    if (fileType !== FileTypes.YAML && baseFolder !== "application") {
      appName = baseFolder;
    }

    this.dialogRef.close({ fileType, appName, createEnv: !!this.createEnv.value });
  }
}
