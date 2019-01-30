export const MESSAGE_TYPES = {
  INIT: 'PercyEditorInit',
  RENDER: 'PercyEditorRender',
  SAVE: 'PercyEditorSave',
  SAVE_CANCELLED: 'PercyEditorSaveCancelled',
  SAVED: 'PercyEditorSaved',
  CLOSE: 'PercyEditorClose',
  FILE_DIRTY: 'PercyEditorFileDirty',
  FILE_CHANGED: 'PercyEditorFileChanged'
};

export const EXTENSION_NAME = 'vscode-percy-editor';

export const COMMANDS = {
  NEW: `${EXTENSION_NAME}.new`,
  NEW_ENV: `${EXTENSION_NAME}.newEnv`,
  EDIT: `${EXTENSION_NAME}.edit`,
  EDIT_SIDE: `${EXTENSION_NAME}.editSide`,
  SAVE_CONFIG: `${EXTENSION_NAME}.saveConfig`,
  SHOW_SOURCE: `${EXTENSION_NAME}.showSource`
};

export const CONFIG = {
  FILE_NAME_REGEX: '^[a-zA-Z0-9_.-]*$',
  PROPERTY_NAME_REGEX: '^[\\s]*[a-zA-Z0-9$_.-]*[\\s]*$',
  ENVIRONMENTS_FILE: 'environmentsFile',
};
