/** ========================================================================
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

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  HostListener
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatDialog } from "@angular/material";
import { map } from "rxjs/operators";

import { Store, select } from "@ngrx/store";
import * as _ from "lodash";

import * as appStore from "store";
import { CommitChanges, SaveDraft } from "store/actions/backend.actions";
import { PageLoad } from "store/actions/editor.actions";

import { appPercyConfig } from "config";

import { EditorComponent } from "components/editor/editor.component";

import { ConfirmationDialogComponent } from "components/confirmation-dialog/confirmation-dialog.component";
import { CommitDialogComponent } from "components/commit-dialog/commit-dialog.component";
import { Observable } from "rxjs";
import { User } from "../../models/auth";

/*
  Configurations editor page
  for both editing existing files and adding new ones
 */
@Component({
  selector: "app-editor-page",
  templateUrl: "./editor.component.html",
  styleUrls: ["./editor.component.scss"]
})
export class EditorPageComponent implements OnInit, OnDestroy {
  appName: string;
  fileName: string;
  editMode = false;
  envFileMode = false;
  isViewOnly = false;

  environments = this.store.pipe(select(appStore.getEnvironments));
  configuration = this.store.pipe(select(appStore.getConfiguration));
  configFile = this.store.pipe(select(appStore.getConfigFile));
  isCommitting = this.store.pipe(select(appStore.getIsCommitting));
  isSaving = this.store.pipe(select(appStore.getIsSaving));

  isPageDirty$ = this.store.pipe(select(appStore.getIsPageDirty));
  isPageDirty = false;

  currentUser: Observable<User> = this.store.pipe(
    select(appStore.getCurrentUser)
  );

  @ViewChild("editor") editor: EditorComponent;

  /**
   * creates the component
   * @param route the route
   * @param store the app store instance
   * @param dialog the mat dialog service
   */
  constructor(
    private route: ActivatedRoute,
    private store: Store<appStore.AppState>,
    private dialog: MatDialog
  ) {}

  /**
   * Initializes the component.
   */
  ngOnInit() {
    // get file content if it's in edit mode
    const routeSnapshot = this.route.snapshot;
    this.editMode = routeSnapshot.data.editMode;
    this.envFileMode = routeSnapshot.data.envFileMode;

    const applicationName = (this.appName = routeSnapshot.paramMap.get(
      "appName"
    ));
    this.fileName =
      this.editMode || this.envFileMode
        ? routeSnapshot.paramMap.get("fileName")
        : null;

    this.store.dispatch(
      new PageLoad({
        fileName: this.fileName,
        applicationName,
        editMode: this.editMode
      })
    );

    this.isPageDirty$.subscribe(res => {
      this.isPageDirty = res;
    });

    this.currentUser.subscribe(res => {
      this.isViewOnly = res && res.branchName === "master";
    });
  }

  /**
   * Hook invoked when component destroy.
   */
  ngOnDestroy() {
    // Reset appPercyConfig
    _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);
  }

  @HostListener("window:beforeunload", ["$event"])
  onLeavePage($event: any) {
    if (this.isPageDirty) {
      $event.returnValue = true;
    }
  }

  /**
   * Checks if component can be deactivated
   * @returns true component can be deactivated, false otherwise
   */
  canDeactivate() {
    if (this.isPageDirty) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          confirmationText:
            "There may be unsaved changes.\nAre you sure you want to navigate away from the page?"
        }
      });
      return dialogRef.afterClosed().pipe(map(response => response));
    }
    return true;
  }

  /**
   * Save draft config.
   */
  saveConfig() {
    this.editor.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }
      const editorState = result.editorState;

      const file = { ...editorState.configFile };
      file.fileName = this.editor.getFileName();
      file.applicationName = this.appName;
      file.draftConfig = editorState.configuration;

      this.store.dispatch(new SaveDraft({ file, redirect: true }));
    });
  }

  /**
   * Commit file.
   */
  commitFile() {
    this.editor.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }

      const editorState = result.editorState;

      const file = { ...editorState.configFile };
      file.fileName = this.editor.getFileName();
      file.applicationName = this.appName;
      file.draftConfig = editorState.configuration;

      const dialogRef = this.dialog.open(CommitDialogComponent);

      dialogRef.afterClosed().subscribe(response => {
        if (response) {
          this.store.dispatch(
            new CommitChanges({
              files: [file],
              message: response,
              fromEditor: true
            })
          );
        }
      });
    });
  }
}
