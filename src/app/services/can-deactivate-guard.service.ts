import { CanDeactivate } from '@angular/router';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * The interface that provides methods to check if component can be deactivated
 */
export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Observable<boolean>;
}

/**
 * This service implements the CanDeactivate method to provide the auth guard
 */
@Injectable({ providedIn: 'root' })
export class CanDeactivateGuard implements CanDeactivate<CanComponentDeactivate> {

  /**
   * checks if component can be deactivated or not
   * @param component the component instance
   */
  canDeactivate(component: CanComponentDeactivate): Observable<boolean> | boolean {
    // if the component has 'canDeactivate' method check from method else allow deactivation
    return component.canDeactivate ? component.canDeactivate() : true;
  }
}
