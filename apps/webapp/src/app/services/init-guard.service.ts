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
import * as BackendActions from "store/actions/backend.actions";
import { Observable } from "rxjs";
import { take, switchMap } from "rxjs/operators";

/**
 * This service implements the CanActivate method to provide the init guard
 */
@Injectable({ providedIn: "root" })
export class InitGuardService implements CanActivate {
  /**
   * initializes the service
   *
   * @param store the store instance
   */
  constructor(private store: Store<fromStore.AppState>) {}

  /**
   * implements guard deciding if a child route which required initialize can be activated or not
   *
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.getPrincipal),
      switchMap(async principal => {
        if (!principal) {
          this.store.dispatch(
            new BackendActions.Initialize({ redirectUrl: state.url })
          );
          return false;
        }

        return true;
      }),
      take(1)
    );
  }
}
