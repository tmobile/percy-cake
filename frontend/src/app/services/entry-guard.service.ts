import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

import { Store, select } from '@ngrx/store';
import * as fromStore from '../store';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { EntryRedirect } from '../store/actions/backend.actions';

/**
 * This service implements the CanActivate method to provide the app entry guard
 */
@Injectable({ providedIn: 'root' })
export class EntryGuardService implements CanActivate {

  /**
   * initializes the service
   * @param store the store instance
   */
  constructor(private store: Store<fromStore.AppState>, private router: Router) { }

  /**
   * implements guard deciding if a child route which required authentication can be activated or not
   * @param route the route associated with a component load.
   * @param state the state of the router at a moment in time.
   */
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.store.pipe(
      select(fromStore.backendState),
      map(backendState => {
        if (!backendState.initialized) {
          const redirectUrl = state.url !== '/entry' ? state.url : null;
          this.store.dispatch(new EntryRedirect({ redirectUrl }));
          return false;
        }
        return true;
      }),
      take(1)
    );
  }
}
