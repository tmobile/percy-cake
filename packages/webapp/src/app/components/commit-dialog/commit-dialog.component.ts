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

import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material";
import { FormControl } from "@angular/forms";
import * as _ from "lodash";

import { NotEmpty } from "services/validators";

/**
 * The commit dialog component
 */
@Component({
  selector: "app-commit-dialog",
  templateUrl: "./commit-dialog.component.html",
  styleUrls: ["./commit-dialog.component.scss"]
})
export class CommitDialogComponent {
  comment: FormControl = new FormControl("", [NotEmpty]);

  /**
   * initializes the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   */
  constructor(public dialogRef: MatDialogRef<CommitDialogComponent>) {}

  /**
   * handles the commit action
   */
  commit() {
    if (!this.comment.valid) {
      return;
    }
    this.dialogRef.close(_.trim(this.comment.value));
  }
}
