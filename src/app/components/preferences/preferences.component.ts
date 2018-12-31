import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import * as _ from 'lodash';

import { NotEmpty } from 'services/validators';
import { electronApi } from 'config';
import { MatDialogRef } from '@angular/material';

/*
  Preferences component
 */
@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss']
})
export class PreferencesComponent implements OnInit {

  environmentsFile = new FormControl('', [NotEmpty, Validators.pattern('^[a-zA-Z0-9]*(\.(yaml|yml))?$')]);
  variablePrefix = new FormControl('', [NotEmpty]);
  variableSuffix = new FormControl('', [NotEmpty]);

  disabed = true;
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
    this.environmentsFile.setValue(this.originalPrefs.environmentsFile);
    this.variablePrefix.setValue(this.originalPrefs.variablePrefix);
    this.variableSuffix.setValue(this.originalPrefs.variableSuffix);

    this.environmentsFile.valueChanges.subscribe(() => {
      this.setDisabed();
    });
    this.variablePrefix.valueChanges.subscribe(() => {
      this.setDisabed();
    });
    this.variableSuffix.valueChanges.subscribe(() => {
      this.setDisabed();
    });
  }

  /**
   * Set whether the save button should be disabled.
   */
  private setDisabed() {
    if (this.environmentsFile.invalid || this.variablePrefix.invalid || this.variableSuffix.invalid) {
      this.disabed = true;
    } else {
      this.disabed = _.isEqual(this.originalPrefs, {
        environmentsFile: this.environmentsFile.value.trim(),
        variablePrefix: this.variablePrefix.value.trim(),
        variableSuffix: this.variableSuffix.value.trim()
      });
    }
  }

  /**
   * Save preferences.
   */
  save() {
    const prefs = {
      environmentsFile: this.environmentsFile.value.trim(),
      variablePrefix: this.variablePrefix.value.trim(),
      variableSuffix: this.variableSuffix.value.trim()
    };
    electronApi.savePreferences(prefs);

    this.originalPrefs = prefs;
    this.disabed = true;
    this.dialogRef.close(true);
  }
}
