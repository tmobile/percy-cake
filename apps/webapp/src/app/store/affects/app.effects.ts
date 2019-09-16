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
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material";
import { of, Observable } from "rxjs";
import { map, tap, exhaustMap } from "rxjs/operators";
import { Actions, Effect, ofType } from "@ngrx/effects";

import { Logout } from "../actions/auth.actions";
import {
  Alert,
  CommonActionTypes,
  AlertClosed,
  APIError,
  Navigate
} from "../actions/common.actions";
import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";

// defines the common effects
@Injectable()
export class AppEffects {
  constructor(
    private actions$: Actions,
    private router: Router,
    private dialog: MatDialog
  ) {}

  /**
   * alert effect
   */
  @Effect({ dispatch: false })
  alert$ = this.actions$.pipe(
    ofType<Alert>(CommonActionTypes.Alert),
    map(action => action.payload),
    tap(data => {
      // refine messages here
      if (data.message === "Failed to fetch") {
        data.message = "Failed to fetch data, please try again.";
      }
      this.dialog.open(AlertDialogComponent, { data });
    })
  );

  /**
   * alert closed effect
   */
  @Effect()
  alertClosed$: Observable<Logout | Navigate> = this.actions$.pipe(
    ofType<AlertClosed>(CommonActionTypes.AlertClosed),
    map(action => action.payload),
    exhaustMap(data => {
      if (data.alertType === "logout") {
        return of(new Logout());
      }
      if (data.alertType === "go-to-dashboard") {
        return of(new Navigate(["/dashboard"]));
      }
      return of();
    })
  );

  // global error effect for API error to log
  @Effect()
  apiError$ = this.actions$.pipe(
    ofType<APIError>(CommonActionTypes.APIError),
    map(action => action.payload),
    exhaustMap(payload => {
      const message = payload.message;
      return of(
        new Alert({
          message: message,
          alertType:
            payload.statusCode === 401 || payload.statusCode === 403
              ? "logout"
              : "error"
        })
      );
    })
  );

  /**
   * navigate effect
   */
  @Effect({ dispatch: false })
  navigate$ = this.actions$.pipe(
    ofType<Navigate>(CommonActionTypes.Navigate),
    tap(action => {
      this.router.navigate(action.payload);
    })
  );
}
