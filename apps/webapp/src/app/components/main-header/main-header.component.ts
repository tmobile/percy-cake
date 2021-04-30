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
import { Router, NavigationEnd } from "@angular/router";
import { Store, select } from "@ngrx/store";
import { MatDialog } from "@angular/material/dialog";
import { Observable } from "rxjs";
import { take } from "rxjs/operators";
import { split } from "lodash";

import * as appStore from "store";
import * as AuthActions from "store/actions/auth.actions";
import { Checkout } from "store/actions/backend.actions";
import { User } from "models/auth";
import { FileManagementService } from "services/file-management.service";
import { CreateBranchDialogComponent } from "components/create-branch-dialog/create-branch-dialog.component";

@Component({
  selector: "app-main-header",
  templateUrl: "./main-header.component.html",
  styleUrls: ["./main-header.component.scss"]
})
export class MainHeaderComponent implements OnInit {
  currentUser: Observable<User> = this.store.pipe(
    select(appStore.getCurrentUser)
  );

  branches: string[];
  currentBranchName: string;
  currentRoute: string;
  isEditorPage = false;

  constructor(
    private store: Store<appStore.AppState>,
    public filService: FileManagementService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    // to disable the branch name popup on editor page
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isEditorPage = split(event.url, "/")[1] === "files" ? true : false;
      }
    });
  }

  /*
    get branches of the repo with which user logged in
   */
  getBranches() {
    this.store
      .pipe(
        select(appStore.getPrincipal),
        take(1)
      )
      .subscribe(async principal => {
        this.branches = await this.filService.listBranches(principal);
        this.currentBranchName = principal.user.branchName;
      });
  }

  /**
    checkout new branch, only if its not already selected
   *
   * @param branch - new branch selected
   */
  checkoutBranch(branch: string) {
    if (branch !== this.currentBranchName) {
      this.store.dispatch(new Checkout({ type: "switch", branch }));
    }
  }

  /*
    open create branch dialog
   */
  createBranch() {
    const dialogRef = this.dialog.open(CreateBranchDialogComponent, {
      data: {
        branches: this.branches
      }
    });
    dialogRef.afterClosed().subscribe(newBranch => {
      if (newBranch) {
        // create new branch and checkout this branch
        this.store.dispatch(
          new Checkout({ type: "create", branch: newBranch })
        );
      }
    });
  }

  /*
   * logout
   */
  logout() {
    this.store.dispatch(new AuthActions.Logout());
  }
}
