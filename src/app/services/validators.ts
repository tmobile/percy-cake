import { AbstractControl } from '@angular/forms';
import * as _ from 'lodash';

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
