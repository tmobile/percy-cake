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
