import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material';
import { of } from 'rxjs';
import { map, tap, exhaustMap } from 'rxjs/operators';
import { Actions, Effect, ofType } from '@ngrx/effects';

import { Logout } from 'store/actions/auth.actions';
import { Alert, CommonActionTypes, AlertClosed, APIError, Navigate } from 'store/actions/common.actions';
import { MaintenanceService } from 'services/maintenance.service';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';

// defines the common effects
@Injectable()
export class AppEffects {

    constructor(
        private actions$: Actions,
        private router: Router,
        private dialog: MatDialog,
        private maintenanceService: MaintenanceService
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
        exhaustMap(response => {
            const message = `[${response.status}]: ${response.error.message}`;
            this.maintenanceService.logError(message).subscribe(() => { }, error => {
                console.error('An error occurred while saving the log error', error);
            });
            return of(new Alert({
              message: response.error.message,
              alertType: response.status === 401 || response.status === 403 ? 'logout' : 'error'
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
