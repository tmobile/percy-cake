import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Store, select } from '@ngrx/store';
import * as fromStore from 'store';
import * as AuthActions from 'store/actions/auth.actions';
import { Observable } from 'rxjs';
import { take, switchMap } from 'rxjs/operators';

import { UtilService } from './util.service';

/**
 * This service implements the CanActivate method to provide the auth guard
 */
@Injectable({ providedIn: 'root' })
export class AuthGuardService implements CanActivate {

  /**
   * initializes the service
   * @param store the store instance
   * @param utilService the util service
   */
  constructor(private store: Store<fromStore.AppState>, private utilService: UtilService) { }

  /**
   * implements guard deciding if a child route which required authentication can be activated or not
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.getCurrentUser),
      switchMap(async (authenticated) => {

        await this.utilService.initConfig();

        if (state.url === '/login') {
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
