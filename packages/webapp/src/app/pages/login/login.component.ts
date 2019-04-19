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

import { Component, OnInit, ViewChild, Inject } from "@angular/core";
import { Router } from "@angular/router";
import { DOCUMENT } from "@angular/common";
import { FormControl, Validators } from "@angular/forms";
import { MatAutocompleteTrigger } from "@angular/material";

import { Store, select } from "@ngrx/store";
import { BehaviorSubject } from "rxjs";
import {
  startWith,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  withLatestFrom,
  tap
} from "rxjs/operators";

import * as _ from "lodash";

import { electronApi, percyConfig } from "config";
import * as appStore from "store";
import * as AuthActions from "store/actions/auth.actions";
import { MaintenanceService } from "services/maintenance.service";
import { NotEmpty } from "services/validators";

const urlFormat = /^\s*(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;

/*
  Login page
 */
@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"]
})
export class LoginComponent implements OnInit {
  username = new FormControl("", [NotEmpty]);
  password = new FormControl("", [NotEmpty]);
  repositoryURL = new FormControl("", [
    NotEmpty,
    Validators.pattern(urlFormat)
  ]);
  loginError: string = null;
  formProcessing = this.store.pipe(select(appStore.getFormProcessing));

  usernameTypeAhead: string[] = [];
  filteredUsernames = new BehaviorSubject<string[]>([]);

  // use to trigger the change in the input from browser auto fill
  @ViewChild("autoTrigger") private autoTrigger: MatAutocompleteTrigger;

  openMode = "";

  /**
   * constructs the component
   * @param router the router instance
   * @param store the app store instance
   * @param maintenanceService the maintenance service
   * @param _document the document instance
   */
  constructor(
    private store: Store<appStore.AppState>,
    private router: Router,
    private maintenanceService: MaintenanceService,
    @Inject(DOCUMENT) private _document: Document
  ) {}

  /**
   * Check if is running electron.
   * @returns true if is running electron, false otherwise
   */
  isElectron() {
    return !!electronApi;
  }

  /**
   * Open local folder.
   */
  openLocalFolder() {
    electronApi.openFolderDialog();
  }

  /**
   * Set open mode.
   * @param openMode the open mode
   */
  setOpenMode(openMode: string) {
    window["openMode"].next(openMode);
  }

  /**
   * handle component initialization
   */
  ngOnInit() {
    if (!this.isElectron()) {
      this.openMode = "remote";
    } else {
      window["openMode"].subscribe(res => {
        this.openMode = res;
      });
    }

    // if currentURL is login then route depending on whether user is logged-in or not
    this.store
      .pipe(select(appStore.getCurrentUser))
      .pipe(
        withLatestFrom(this.store.pipe(select(appStore.getRedirectUrl))),
        tap(([isAuthenticated, redirectUrl]) => {
          if (isAuthenticated) {
            return this.router.navigate([redirectUrl || "/dashboard"]);
          }
        })
      )
      .subscribe();

    this.username.valueChanges
      .pipe(
        startWith(null),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(value => this._filter(value))
      )
      .subscribe(this.filteredUsernames);

    this.repositoryURL.setValue(percyConfig.defaultRepositoryUrl);

    this.store
      .pipe(
        select(appStore.getLoginError),
        tap(le => {
          this.loginError = null;

          if (!le) {
            return;
          }

          // Show the error in form field
          if (le["statusCode"] === 401) {
            this.password.setErrors({ invalid: true });
            return this.username.setErrors({ invalid: true });
          } else if (le["statusCode"] === 403) {
            return this.repositoryURL.setErrors({ forbidden: true });
          } else if (le.message === "Repository not found") {
            return this.repositoryURL.setErrors({ notFound: true });
          }

          this.loginError = "Login failed";
        })
      )
      .subscribe();
  }

  /*
   * login if the form is valid
   */
  login() {
    // trim fields
    this.username.setValue(_.trim(this.username.value));
    this.repositoryURL.setValue(_.trim(this.repositoryURL.value));

    if (
      this.username.valid &&
      this.password.valid &&
      this.repositoryURL.valid
    ) {
      const url = new URL(this.repositoryURL.value);
      url.pathname = url.pathname.replace(/(\/)+$/, "");
      url.pathname = url.pathname.replace(/(\.git)$/, "");
      this.store.dispatch(
        new AuthActions.Login({
          repositoryUrl: url.href,
          username: this.username.value,
          password: this.password.value
        })
      );
    }
  }

  /*
   * when user types in an input field remove error messages
   */
  inputChange(field?: string) {
    this.loginError = null;

    if (field === "user-pass") {
      if (_.trim(this.username.value) !== "") {
        this.username.setErrors(null);
      }

      if (this.password.value !== "") {
        this.password.setErrors(null);
      }
    }
  }

  /**
   * handles the input event of input field
   * this is used to support browser auto fill pass the validation
   * otherwise chrome will show required for username when username is
   * filled from browser auto fill
   * @param event the key board input event
   */
  onInput = (event: KeyboardEvent) => {
    const target = event.currentTarget as HTMLInputElement;

    if (this._document.activeElement !== target) {
      this.autoTrigger._onChange(target.value);
    }
  }

  /**
   * filters the usernames with given prefix
   * @param value the prefix
   */
  private async _filter(value: string) {
    const filterValue = _.trim(value).toLowerCase();
    // only call API if first character else filter from cache value
    if (filterValue.length === 1) {
      const typeAhead = await this.maintenanceService.getUserTypeAhead(
        filterValue
      );
      this.usernameTypeAhead = typeAhead;
      return this.usernameTypeAhead.filter(option =>
        _.startsWith(option.toLowerCase(), filterValue)
      );
    } else {
      return this.usernameTypeAhead.filter(option =>
        _.startsWith(option.toLowerCase(), filterValue)
      );
    }
  }
}
