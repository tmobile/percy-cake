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

import { AbstractControl } from "@angular/forms";
import * as _ from "lodash";

/**
 * A validtor used to verify string value is not empty.
 * @param control the form control with string value
 * @returns the validation error of null if not any
 */
export function NotEmpty(control: AbstractControl) {
  if (!_.trim(control.value)) {
    return { required: true };
  }
  return null;
}

/**
 * A validtor used to verify string value is with pattern after trim.
 * @param pattern the string pattern
 * @returns the validator
 */
export function TrimPattern(pattern: string) {
  return (control: AbstractControl) => {
    const trimValue = _.trim(control.value);
    if (!trimValue) {
      return { required: true };
    }
    if (!new RegExp(pattern).test(trimValue)) {
      return { pattern: true };
    }
    return null;
  };
}
