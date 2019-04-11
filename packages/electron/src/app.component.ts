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
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material";
import { Store } from "@ngrx/store";
import { BehaviorSubject } from "rxjs";

import { electronApi } from "config";
import { UtilService } from "services/util.service";
import * as appStore from "store";
import * as AuthActions from "store/actions/auth.actions";

import { PreferencesComponent } from "./components/preferences/preferences.component";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html"
})
export class ElectronAppComponent implements OnInit {
  /**
   * constructs the component.
   * @param router the router service
   * @param dialog the dialog service
   * @param utilService the util service
   */
  constructor(
    private router: Router,
    private dialog: MatDialog,
    private utilService: UtilService,
    private store: Store<appStore.AppState>
  ) {}

  /**
   * Wrap the callbacks in angular zone.
   * @param callbacks The callbacks
   */
  private wrapInZone(callbacks) {
    Object.keys(callbacks).forEach(key => {
      const prev = callbacks[key];
      callbacks[key] = this.utilService.wrapInZone(prev);
    });
    return callbacks;
  }

  /**
   * initializes the component.
   */
  ngOnInit() {
    if (electronApi) {
      const openMode = (window["openMode"] = new BehaviorSubject(""));

      // Register the renderer ipc events listerner
      electronApi.registerRendererListeners(
        this.wrapInZone({
          openFolder: (folder: string) => {
            this.router.navigate(["/electron", folder]);
          },
          openRepo: () => {
            this.store.dispatch(new AuthActions.Logout());
            openMode.next("remote");
          },
          showPreferences: () => {
            this.dialog
              .open(PreferencesComponent)
              .afterClosed()
              .subscribe(res => {
                if (res) {
                  window.location.reload();
                }
              });
          }
        })
      );
    }
  }
}
