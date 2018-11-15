import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Store, select } from '@ngrx/store';
import * as fromStore from '../store';
import * as AuthActions from '../store/actions/auth.actions';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

/**
 * This service implements the CanActivate method to provide the auth guard
 */
@Injectable({ providedIn: 'root' })
export class AuthGuardService implements CanActivate {

  /**
   * initializes the service
   * @param store the store instance
   */
  constructor(private store: Store<fromStore.AppState>) { }

  /**
   * implements guard deciding if a child route which required authentication can be activated or not
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.getLoggedIn),
      map(authenticated => {
        if (!authenticated) {
          const redirectUrl = state.url !== '/login' ? state.url : null;
          // if the user is not logged-in then navigate to login page and store the attempted URL
          this.store.dispatch(new AuthActions.LoginRedirect({ redirectUrl: redirectUrl }));
          return false;
        }
        return true;
      }),
      take(1)
    );
  }
}
