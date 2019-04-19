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

import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from "@angular/router";

import { Store, select } from "@ngrx/store";
import * as fromStore from "store";
import * as AuthActions from "store/actions/auth.actions";
import { Observable } from "rxjs";
import { take, switchMap } from "rxjs/operators";

import { UtilService } from "./util.service";

/**
 * This service implements the CanActivate method to provide the auth guard
 */
@Injectable({ providedIn: "root" })
export class AuthGuardService implements CanActivate {
  /**
   * initializes the service
   * @param store the store instance
   * @param utilService the util service
   */
  constructor(
    private store: Store<fromStore.AppState>,
    private utilService: UtilService
  ) {}

  /**
   * implements guard deciding if a child route which required authentication can be activated or not
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.getCurrentUser),
      switchMap(async authenticated => {
        await this.utilService.initConfig();

        if (state.url === "/login") {
          return true;
        }

        if (!authenticated) {
          const redirectUrl = state.url;
          // if the user is not logged-in then navigate to login page and store the attempted URL
          this.store.dispatch(new AuthActions.LoginRedirect({ redirectUrl }));
          return false;
        }
        return true;
      }),
      take(1)
    );
  }
}
