/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { CanDeactivate } from "@angular/router";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

/**
 * The interface that provides methods to check if component can be deactivated
 */
export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Observable<boolean>;
}

/**
 * This service implements the CanDeactivate method to provide the auth guard
 */
@Injectable({ providedIn: "root" })
export class CanDeactivateGuard
  implements CanDeactivate<CanComponentDeactivate> {
  /**
   * checks if component can be deactivated or not
   *
   * @param component the component instance
   */
  canDeactivate(
    component: CanComponentDeactivate
  ): Observable<boolean> | boolean {
    // if the component has 'canDeactivate' method check from method else allow deactivation
    return component.canDeactivate ? component.canDeactivate() : true;
  }
}
