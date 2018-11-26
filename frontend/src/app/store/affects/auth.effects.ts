import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, map, withLatestFrom } from 'rxjs/operators';
import * as _ from 'lodash';

import * as appStore from 'store';
import {
    AuthActionTypes,
    Login,
    LoginFailure,
    LoginSuccess,
    LogoutSuccess,
    GetDefaultRepo,
    GetDefaultRepoSuccess,
    GetDefaultRepoFailure,
} from 'store/actions/auth.actions';
import { Navigate } from 'store/actions/common.actions';
import { Authenticate } from 'models/auth';
import { MaintenanceService } from 'services/maintenance.service';
import { FileManagementService } from 'services/file-management.service';

// defines the authentication effects
@Injectable()
export class AuthEffects {
    constructor(
        private actions$: Actions,
        private maintenanceService: MaintenanceService,
        private fileManagementService: FileManagementService,
        private store: Store<appStore.AppState>

    ) { }

    // login request effect
    @Effect()
    getDefaultRepo$ = this.actions$.pipe(
        ofType<GetDefaultRepo>(AuthActionTypes.GetDefaultRepo),
        exhaustMap(() =>
          this.maintenanceService.getDefaultRepo()
            .pipe(
              map(defaultRepo => new GetDefaultRepoSuccess(defaultRepo)),
              catchError(error => of(new GetDefaultRepoFailure(error)))
            )
        )
    );

    // login request effect
    @Effect()
    login$ = this.actions$.pipe(
        ofType<Login>(AuthActionTypes.Login),
        map(action => action.payload),
        exhaustMap(async (authInfo: Authenticate) => {
          try {
            const user = await this.fileManagementService.accessRepo(authInfo);
            return new LoginSuccess(_.omit(user, 'password'));
          } catch (error) {
            return new LoginFailure(error);
          }
        })
    );

    // login success effect
    @Effect()
    loginSuccess$ = this.actions$.pipe(
        ofType<LoginSuccess>(AuthActionTypes.LoginSuccess),
        withLatestFrom(this.store.pipe(select(appStore.getRedirectUrl))),
        map(([action, redirectUrl]) => new Navigate([redirectUrl || '/dashboard']))
    );

    // login redirect effect
    @Effect()
    loginRedirect$ = this.actions$.pipe(
        ofType(AuthActionTypes.LoginRedirect, AuthActionTypes.LogoutSuccess),
        map(() => new Navigate(['/login']))
    );

    // logout request effect
    @Effect()
    logout$ = this.actions$.pipe(
      ofType(AuthActionTypes.Logout),
      map(() => new LogoutSuccess())
  );
}
