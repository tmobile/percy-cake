import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, map, tap, withLatestFrom } from 'rxjs/operators';
import * as _ from 'lodash';

import {
    AuthActionTypes,
    Login,
    LoginFailure,
    LoginSuccess,
    LogoutSuccess,
    GetDefaultRepo,
    GetDefaultRepoSuccess,
    GetDefaultRepoFailure,
} from '../actions/auth.actions';
import { Authenticate } from '../../models/auth';
import { MaintenanceService } from '../../services/maintenance.service';
import { FileManagementService } from '../../services/file-management.service';
import { Store, select } from '@ngrx/store';
import * as appStore from '..';

// defines the authentication effects
@Injectable()
export class AuthEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
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
        exhaustMap((authInfo: Authenticate) =>
            this.fileManagementService.accessRepo(authInfo.repositoryUrl, authInfo.branchName, authInfo.username, authInfo.password)
                .pipe(
                    map(loginResult => new LoginSuccess(_.omit({ ...loginResult, ...authInfo }, 'password'))),
                    catchError(error => of(new LoginFailure(error)))
                )
        )
    );

    // login success effect
    @Effect({ dispatch: false })
    loginSuccess$ = this.actions$.pipe(
        ofType<LoginSuccess>(AuthActionTypes.LoginSuccess),
        withLatestFrom(this.store.pipe(select(appStore.getRedirectUrl))),
        tap(([action, redirectUrl]) => {
            redirectUrl = redirectUrl || '/dashboard';
            return this.router.navigate([redirectUrl]);
        })
    );

    // login redirect effect
    @Effect({ dispatch: false })
    loginRedirect$ = this.actions$.pipe(
        ofType(AuthActionTypes.LoginRedirect, AuthActionTypes.LogoutSuccess),
        tap(() => {
            this.router.navigate(['/login']);
        })
    );

    // logout request effect
    @Effect()
    logout$ = this.actions$.pipe(
        ofType(AuthActionTypes.Logout),
        map(() => new LogoutSuccess())
    );
}
