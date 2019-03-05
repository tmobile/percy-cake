/**
 *   Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { exhaustMap, map, withLatestFrom } from 'rxjs/operators';
import * as _ from 'lodash';

import * as appStore from '..';
import {
  AuthActionTypes,
  Login,
  LoginFailure,
  LoginSuccess,
  LogoutSuccess,
} from '../actions/auth.actions';
import { Navigate } from '../actions/common.actions';
import { Authenticate } from 'models/auth';
import { FileManagementService } from 'services/file-management.service';

// defines the authentication effects
@Injectable()
export class AuthEffects {
  constructor(
    private actions$: Actions,
    private fileManagementService: FileManagementService,
    private store: Store<appStore.AppState>
  ) { }

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
    map(([_action, redirectUrl]) => new Navigate([redirectUrl || '/dashboard']))
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
