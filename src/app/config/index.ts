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
