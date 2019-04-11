/**
=========================================================================
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

export const MESSAGE_TYPES = {
  INIT: "PercyEditorInit",
  RENDER: "PercyEditorRender",
  SAVE: "PercyEditorSave",
  SAVE_CANCELLED: "PercyEditorSaveCancelled",
  SAVED: "PercyEditorSaved",
  CLOSE: "PercyEditorClose",
  FILE_DIRTY: "PercyEditorFileDirty",
  FILE_CHANGED: "PercyEditorFileChanged"
};

export const EXTENSION_NAME = "vscode-percy-editor";

export const COMMANDS = {
  NEW: `${EXTENSION_NAME}.new`,
  NEW_ENV: `${EXTENSION_NAME}.newEnv`,
  EDIT: `${EXTENSION_NAME}.edit`,
  EDIT_SIDE: `${EXTENSION_NAME}.editSide`,
  SAVE_CONFIG: `${EXTENSION_NAME}.saveConfig`,
  SHOW_SOURCE: `${EXTENSION_NAME}.showSource`
};

export const CONFIG = {
  FILE_NAME_REGEX: "^[a-zA-Z0-9_.-]*$",
  PROPERTY_NAME_REGEX: "^[\\s]*[a-zA-Z0-9$_.-]*[\\s]*$",
  ENVIRONMENTS_FILE: "environmentsFile"
};
