import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material';
import * as _ from 'lodash';

import { NotEmpty } from 'services/validators';
import { electronApi } from 'config';

/*
  Preferences component
 */
@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss']
})
export class PreferencesComponent implements OnInit {

  envFileSuffix = '.yaml';

  environmentsFile = new FormControl('', [NotEmpty, Validators.maxLength(30), Validators.pattern('^[\\s]*[a-zA-Z0-9]*[\\s]*$')]);
  variablePrefix = new FormControl('', [NotEmpty]);
  variableSuffix = new FormControl('', [NotEmpty]);
  variableNamePrefix = new FormControl('', [NotEmpty, Validators.pattern('^[\\s]*[\\S]*[\\s]*$')]);

  disabed = true;
  prefs: any;
  originalPrefs: any;

  /**
   * constructs the component.
   * @param dialogRef the dialog reference
   */
  constructor(private dialogRef: MatDialogRef<PreferencesComponent>) {}

  /**
   * initializes the component.
   */
  ngOnInit() {

    this.originalPrefs = electronApi.getPreferences();
    this.environmentsFile.setValue(_.replace(this.originalPrefs.environmentsFile, this.envFileSuffix, ''));
    this.variablePrefix.setValue(this.originalPrefs.variablePrefix);
    this.variableSuffix.setValue(this.originalPrefs.variableSuffix);
    this.variableNamePrefix.setValue(this.originalPrefs.variableNamePrefix);

    _.each([this.environmentsFile, this.variablePrefix, this.variableSuffix, this.variableNamePrefix], (ctl) => {
      ctl.valueChanges.subscribe(() => {
        this.setDisabed();
      });
    });
  }

  /**
   * Set whether the save button should be disabled.
   */
  private setDisabed() {
    if (this.environmentsFile.invalid || this.variablePrefix.invalid || this.variableSuffix.invalid || this.variableNamePrefix.invalid) {
      this.disabed = true;
    } else {
      this.prefs = {
        environmentsFile: this.environmentsFile.value.trim() + this.envFileSuffix,
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
