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

// user key for local or session storage after login
export const LOGGED_IN_USER_KEY = 'auth';

// property value type options
export enum PROPERTY_VALUE_TYPES {
  STRING = 'string',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  OBJECT = 'object',
  STRING_ARRAY = 'string[]',
  NUMBER_ARRAY = 'number[]',
  BOOLEAN_ARRAY = 'boolean[]',
  OBJECT_ARRAY = 'object[]',
}

// The percy config will be loaded at this web app load, see UtilService#initConfig method
export const percyConfig: any = {};

// The app's specific percy config, will be loaded when editor page load, see EditorEffects#pageLoad method
export const appPercyConfig: any = {};

// The electron api, only available when running in electron
export const electronApi = window['acquireElectionApi'] ? window['acquireElectionApi']() : null;
