import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Store, select } from '@ngrx/store';
import * as fromStore from 'store';
import * as BackendActions from 'store/actions/backend.actions';
import { Observable } from 'rxjs';
import { take, switchMap } from 'rxjs/operators';

/**
 * This service implements the CanActivate method to provide the init guard
 */
@Injectable({ providedIn: 'root' })
export class InitGuardService implements CanActivate {

  /**
   * initializes the service
   * @param store the store instance
   */
  constructor(private store: Store<fromStore.AppState>) { }

  /**
   * implements guard deciding if a child route which required initialize can be activated or not
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.getPrincipal),
      switchMap(async (principal) => {

        if (!principal) {
          this.store.dispatch(new BackendActions.Initialize({ redirectUrl: state.url }));
          return false;
        }

        return true;
      }),
      take(1)
    );
  }
}
