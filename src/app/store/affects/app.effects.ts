import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material';
import { of } from 'rxjs';
import { map, tap, exhaustMap } from 'rxjs/operators';
import { Actions, Effect, ofType } from '@ngrx/effects';
import * as boom from 'boom';

import { Logout } from '../actions/auth.actions';
import { Alert, CommonActionTypes, AlertClosed, APIError, Navigate } from '../actions/common.actions';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';

// defines the common effects
@Injectable()
export class AppEffects {

  constructor(
    private actions$: Actions,
    private router: Router,
    private dialog: MatDialog,
  ) { }

  /**
   * alert effect
   */
  @Effect({ dispatch: false })
  alert$ = this.actions$.pipe(
    ofType<Alert>(CommonActionTypes.Alert),
    map(action => action.payload),
    tap(data => {
      this.dialog.open(AlertDialogComponent, { data });
    })
  );

  /**
   * alert closed effect
   */
  @Effect()
  alertClosed$ = this.actions$.pipe(
    ofType<AlertClosed>(CommonActionTypes.AlertClosed),
    map(action => action.payload),
    exhaustMap(data => {
      if (data.alertType === 'logout') {
        return of(new Logout());
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
      const error = boom.boomify(payload);
      const message = error.message;
      return of(new Alert({
        message: message,
        alertType: error.output.statusCode === 401 || error.output.statusCode === 403 ? 'logout' : 'error'
      }));
    }),
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
