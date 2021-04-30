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

import { Component, OnInit } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import * as _ from "lodash";

import { NotEmpty } from "services/validators";
import { electronApi } from "config";

/*
  Preferences component
 */
@Component({
  selector: "app-preferences",
  templateUrl: "./preferences.component.html",
  styleUrls: ["./preferences.component.scss"]
})
export class PreferencesComponent implements OnInit {
  envFileSuffix = ".yaml";

  environmentsFile = new FormControl("", [
    NotEmpty,
    Validators.maxLength(30),
    Validators.pattern("^[\\s]*[a-zA-Z0-9]*[\\s]*$")
  ]);
  variablePrefix = new FormControl("", [NotEmpty]);
  variableSuffix = new FormControl("", [NotEmpty]);
  variableNamePrefix = new FormControl("", [
    NotEmpty,
    Validators.pattern("^[\\s]*[\\S]*[\\s]*$")
  ]);

  disabed = true;
  prefs: any;
  originalPrefs: any;

  /**
   * constructs the component.
   *
   * @param dialogRef the dialog reference
   */
  constructor(private dialogRef: MatDialogRef<PreferencesComponent>) {}

  /**
   * initializes the component.
   */
  ngOnInit() {
    this.originalPrefs = electronApi.getPreferences();
    this.environmentsFile.setValue(
      _.replace(this.originalPrefs.environmentsFile, this.envFileSuffix, "")
    );
    this.variablePrefix.setValue(this.originalPrefs.variablePrefix);
    this.variableSuffix.setValue(this.originalPrefs.variableSuffix);
    this.variableNamePrefix.setValue(this.originalPrefs.variableNamePrefix);

    _.each(
      [
        this.environmentsFile,
        this.variablePrefix,
        this.variableSuffix,
        this.variableNamePrefix
      ],
      ctl => {
        ctl.valueChanges.subscribe(() => {
          this.setDisabed();
        });
      }
    );
  }

  /**
   * Set whether the save button should be disabled.
   */
  private setDisabed() {
    if (
      this.environmentsFile.invalid ||
      this.variablePrefix.invalid ||
      this.variableSuffix.invalid ||
      this.variableNamePrefix.invalid
    ) {
      this.disabed = true;
    } else {
      this.prefs = {
        environmentsFile:
          this.environmentsFile.value.trim() + this.envFileSuffix,
        variablePrefix: this.variablePrefix.value.trim(),
        variableSuffix: this.variableSuffix.value.trim(),
        variableNamePrefix: this.variableNamePrefix.value.trim()
      };
      this.disabed = _.isEqual(this.originalPrefs, this.prefs);
    }
  }

  /**
   * Save preferences.
   */
  save() {
    electronApi.savePreferences(this.prefs);

    this.originalPrefs = this.prefs;
    this.disabed = true;
    this.dialogRef.close(true);
  }
}
