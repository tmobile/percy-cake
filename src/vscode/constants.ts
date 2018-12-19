export const MESSAGE_TYPES = {
  INIT: 'PercyEditorInit',
  ACTIVATE: 'PercyEditorActivate',
  SAVE: 'PercyEditorSave',
  SAVED: 'PercyEditorSaved',
  CLOSE: 'PercyEditorClose'
};

export const EXTENSION_NAME = 'vscode-percy-editor';

export const COMMANDS = {
  NEW: `${EXTENSION_NAME}.new`,
  NEW_ENV: `${EXTENSION_NAME}.newenv`,
  EDIT: `${EXTENSION_NAME}.edit`,
  EDIT_SIDE: `${EXTENSION_NAME}.editside`,
  SAVE_CONFIG: `${EXTENSION_NAME}.saveConfig`,
  SHOW_SOURCE: `${EXTENSION_NAME}.showSource`
};

export const CONFIG = {
  ENVIRONMENTS_FILE: 'environmentsFile',
};
