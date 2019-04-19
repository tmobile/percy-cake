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

import * as _ from "lodash";
import { Subscription } from "rxjs";
import { map } from "rxjs/operators";

import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Component, OnInit, OnDestroy, HostListener } from "@angular/core";
import { NestedTreeControl } from "@angular/cdk/tree";
import {
  MatTreeNestedDataSource,
  MatDialog,
  MatDialogRef
} from "@angular/material";
import { Store, select } from "@ngrx/store";

import { electronApi, percyConfig, appPercyConfig } from "config";
import { TreeNode } from "models/tree-node";
import { Configuration } from "models/config-file";

import * as appStore from "store";
import { PageRestore } from "store/actions/editor.actions";
import { LoadFilesSuccess, Initialize } from "store/actions/backend.actions";
import { State as EditorState } from "store/reducers/editor.reducer";
import { UtilService } from "services/util.service";

import { EditorComponent } from "components/editor/editor.component";
import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";
import { ConfirmationDialogComponent } from "components/confirmation-dialog/confirmation-dialog.component";

import { File } from "../../../app/File";

/**
 * Electron local folder/files editor compoent. It supports multiple editors for multiple files.
 */
@Component({
  selector: "app-electron",
  templateUrl: "./electron.component.html",
  styleUrls: ["./electron.component.scss"]
})
export class ElectronPageComponent implements OnInit, OnDestroy {
  fileTreeControl: NestedTreeControl<File>;
  fileDataSource: MatTreeNestedDataSource<File>;

  openedFiles: File[] = [];
  selectedEditor = new FormControl(0);

  editorStates: { [key: number]: EditorState } = {};
  changedDialogRef: {
    [key: string]: MatDialogRef<ConfirmationDialogComponent>;
  } = {};

  newFileIno = -1;

  sub: Subscription;

  /**
   * creates the component
   * @param route the route
   * @param store the app store instance
   * @param dialog the mat dialog service
   * @param utilService the util service
   */
  constructor(
    private route: ActivatedRoute,
    private store: Store<appStore.AppState>,
    private dialog: MatDialog,
    private utilService: UtilService
  ) {}

  /**
   * Initialize component.
   */
  ngOnInit() {
    this.utilService.initConfig();

    this.sub = this.store
      .pipe(select(appStore.editorState))
      .subscribe(editorState => {
        if (!editorState.configFile) {
          return;
        }
        const filePath = editorState.configFile["path"];
        if (!filePath) {
          return;
        }

        // Align editor state
        const state = this.editorStates[filePath];
        if (state) {
          state.configuration = editorState.configuration;
        }

        // Align file state
        const file = this.findOpenedFile(filePath);
        if (file) {
          file.modified = editorState.configFile.modified;
          file.configuration = editorState.configuration;
        }
      });

    this.route.params.subscribe(() => {
      this.onRouteChange();
    });
  }

  /**
   * Destroy the component.
   */
  ngOnDestroy() {
    this.sub.unsubscribe();

    this.unwatchFiles();

    // Reset appPercyConfig
    _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);

    // Clear backend state
    this.store.dispatch(new Initialize({ redirectUrl: "" }));
  }

  /**
   * Unwatch files.
   */
  private unwatchFiles() {
    this.openedFiles.forEach(file => {
      if (file.editMode) {
        electronApi.unwatchFile(file.path);
      }
    });
  }

  /**
   * Hanldes route change to open different folder.
   */
  onRouteChange() {
    this.unwatchFiles();

    this.openedFiles = [];
    this.editorStates = {};

    const routeSnapshot = this.route.snapshot;
    const folderPath = routeSnapshot.paramMap.get("folder");

    this.fileDataSource = new MatTreeNestedDataSource();

    const _getChildren = (node: File) => node.children;
    this.fileTreeControl = new NestedTreeControl<File>(_getChildren);

    const newFolder = electronApi.constructFolder(folderPath);
    newFolder.expanded = true;
    this.fileDataSource.data = [newFolder];
    this.populateFolder(newFolder);
  }

  /**
   * Prevent window unload when there is any change.
   */
  @HostListener("window:beforeunload", ["$event"])
  onLeavePage($event: any) {
    if (this.hasChange()) {
      $event.returnValue = true;
    }
  }

  /**
   * Checks if component can be deactivated
   * @returns true component can be deactivated, false otherwise
   */
  canDeactivate() {
    if (this.hasChange()) {
      return this.showUnsaveDialog(
        "Are you sure you want to navigate away from the page?"
      ).pipe(map(response => response));
    }
    return true;
  }

  /**
   * Dispatch window resize event when split drag between file explorer and editors.
   */
  splitDrag() {
    // When drag splitter between file explorer and editors,
    // dispatch window resize event, so that the MAT tabs component
    // will recaculate width to show/hide scroll header
    window.dispatchEvent(new Event("resize"));
  }

  /*
   * when condition in mat-nested-tree-node
   * which returns true if a node has children
   */
  hasNestedChild = (_n: number, node: File) => !node.isFile;

  /**
   * Check whether there is any change.
   */
  hasChange() {
    return !!this.openedFiles.find(f => f.modified);
  }

  /**
   * Find folder.
   * @param folderPath the folder path
   * @param folders the folders to find
   * @returns folder found
   */
  private findFolder(folderPath: string, folders: File[]): File {
    for (const folder of folders) {
      if (!folder.isFile) {
        if (folder.path === folderPath) {
          return folder;
        }
        if (folderPath.startsWith(folder.path)) {
          return this.findFolder(folderPath, folder.children);
        }
      }
    }
  }

  /**
   * Refresh folder.
   * @param folderPath the folder path
   */
  refreshFolder(folderPath: string) {
    const expandFolders = (_folders: File[]) => {
      _folders.forEach(_folder => {
        if (!_folder.isFile) {
          _folder.folderPopulated = false;

          const found = this.findFolder(_folder.path, this.fileDataSource.data);
          if (found) {
            _folder.expanded = found.expanded;
          }
          if (_folder.expanded) {
            this.populateFolder(_folder, false);
          }
          expandFolders(_folder.children);
        }
      });
    };

    const newFolder = electronApi.constructFolder(folderPath);
    expandFolders([newFolder]);

    this.fileDataSource.data = [newFolder];
    this.refreshFileExplorer();
  }

  /**
   * Populate folder.
   * @param folder The folder to populate
   * @param refreshExplorer Flag indicates whether to refresh file explorer, default to true
   */
  private populateFolder(folder: File, refreshExplorer = true) {
    electronApi.populateFolder(folder);
    this.sortFolderChildren(folder);
    if (refreshExplorer) {
      this.refreshFileExplorer();
    }
  }

  /**
   * Sort folder's children.
   * @param folder The folder to sort its children
   */
  private sortFolderChildren(folder: File) {
    folder.children = folder.children.sort((a, b) => {
      if (a.path < b.path) {
        return -1;
      }
      if (a.path > b.path) {
        return 1;
      }
      return 0;
    });

    const envFile = this.getEnvFile(folder);
    if (envFile) {
      folder.children = [
        envFile,
        ...folder.children.filter(
          f => f.fileName !== percyConfig.environmentsFile
        )
      ];
    }
  }

  /**
   * Refresh file explorer.
   * @param updateBackend Flag indicates whether to update backend, default to true
   */
  private refreshFileExplorer(updateBackend: boolean = true) {
    const data = this.fileDataSource.data;
    this.fileDataSource.data = null;
    this.fileDataSource.data = data;

    if (updateBackend) {
      this.setBackendState();
    }
  }

  /**
   * Set backend state.
   */
  private setBackendState() {
    const folders = this.fileDataSource.data;
    const allFiles = this.getAllFiles(folders);
    this.store.dispatch(
      new LoadFilesSuccess({
        files: allFiles,
        applications: [],
        appConfigs: {}
      })
    );
  }

  /**
   * Get all files in folder rescursively.
   * @param folder the folder
   * @returns all files in folder
   */
  private getAllFiles(folders: File[]) {
    const result: File[] = [];
    folders.forEach(folder => {
      folder.children.forEach(child => {
        if (child.isFile) {
          result.push(child);
        } else {
          result.push(...this.getAllFiles([child]));
        }
      });
    });
    return result;
  }

  /**
   * Get file title.
   * @param file the file
   * @returns file title
   */
  getFileTitle(file: File) {
    let result = file.modified ? "*" + file.fileName : file.fileName;

    if (file.editMode && !file.parent.hasChild(file.path)) {
      result += " (deleted from disk)";
    }

    return result;
  }

  /**
   * Toggle folder.
   * @param folder the folder to toggle
   */
  toggle(folder: File) {
    folder.expanded = !folder.expanded;
    if (!folder.folderPopulated) {
      this.populateFolder(folder);
    } else {
      this.refreshFileExplorer(false);
    }
  }

  /**
   * Find opened file.
   * @param filePath The file path
   * @returns found file
   */
  private findOpenedFile(filePath: string) {
    return this.openedFiles.find(f => f.path === filePath);
  }

  /**
   * Get environments of folder.
   * @param folderPath The folder path
   * @returns environments
   */
  private getEnvironments(folderPath: string) {
    // Parse environments
    const envPath = electronApi.path.resolve(
      folderPath,
      percyConfig.environmentsFile
    );
    const envContent = electronApi.readFile(envPath);
    if (envContent) {
      const envConfig = this.parseYaml(envContent, envPath);
      return _.map(
        _.get(envConfig.environments, "children", <TreeNode[]>[]),
        child => child.key
      );
    } else {
      return [];
    }
  }

  /**
   * Edit file.
   * @param file the file to edit
   */
  editFile(file: File) {
    if (!file.isFile) {
      this.toggle(file);
      return;
    }

    const opened = this.findOpenedFile(file.path);
    if (!opened) {
      // Parse environments
      file.environments = this.getEnvironments(
        electronApi.path.dirname(file.path)
      );

      // Parse file content
      const fileContent = electronApi.readFile(file.path);
      file.originalConfig = this.parseYaml(fileContent, file.path);
      file.configuration = _.cloneDeep(file.originalConfig);
      file.modified = false;

      file.editMode = true;
      file.envFileMode = file.fileName === percyConfig.environmentsFile;

      this.openedFiles.push(file);
      this.setEditorState(file, false);
      this.selectTab(this.openedFiles.length - 1);

      this.watchFile(file);
    } else {
      this.selectTab(this.openedFiles.indexOf(opened));
    }
  }

  /**
   * Watch file.
   * @param file the file to watch
   */
  private watchFile(file: File) {
    const filePath = file.path;
    electronApi.watchFile(
      filePath,
      this.utilService.wrapInZone(event => {
        if (event === "deleted") {
          file.parent.removeChild(filePath);
          this.refreshFileExplorer();
        } else if (event === "changed") {
          const _file = this.findOpenedFile(file.path);
          if (_file) {
            const _fileContent = electronApi.readFile(filePath);
            const originalConfig = this.parseYaml(_fileContent, filePath);
            if (!_.isEqual(originalConfig, _file.originalConfig)) {
              if (this.changedDialogRef[filePath]) {
                this.changedDialogRef[
                  filePath
                ].componentInstance.data.originalConfig = originalConfig;
                return;
              }

              const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
                data: {
                  originalConfig,
                  confirmationText: `${filePath} is changed externally. Do you want to reload the file?`
                }
              });
              dialogRef.afterClosed().subscribe(res => {
                delete this.changedDialogRef[filePath];
                if (res) {
                  _file.originalConfig =
                    dialogRef.componentInstance.data.originalConfig;
                  _file.configuration = _.cloneDeep(_file.originalConfig);
                  _file.modified = false;
                  this.setEditorState(_file);
                }
              });
              this.changedDialogRef[filePath] = dialogRef;
            }
          }
        }
      })
    );
  }

  /**
   * Set editor state.
   * @param file the file in editting
   * @param dispath the flag indicates whether to dispatch state
   */
  private setEditorState(file: File, dispath: boolean = true) {
    const state: EditorState = {
      configFile: file,
      editMode: file.editMode,
      environments: file.environments,
      configuration: file.configuration,
      isCommitting: false,
      isSaving: false,
      isPageDirty: false
    };
    this.editorStates[file.path] = state;
    if (dispath) {
      this.store.dispatch(new PageRestore(state));
    }
  }

  /**
   * Select a tab of the opened files to show.
   * @param index the index of tab to show
   */
  selectTab(index: number) {
    this.selectedEditor.setValue(index);

    if (index >= 0 && index < this.openedFiles.length) {
      const file = this.openedFiles[index];

      // Reset appPercyConfig
      _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);
      _.assign(appPercyConfig, electronApi.getAppPercyConfig(file));

      // Set editor state
      this.store.dispatch(new PageRestore(this.editorStates[file.path]));
    }
  }

  /**
   * Reset file by discarding changes.
   * @param file the file to reset
   */
  reset(file: File) {
    if (file.editMode) {
      file.modified = false;
      file.configuration = _.cloneDeep(file.originalConfig);
    } else {
      file.configuration = new Configuration();
    }
    this.setEditorState(file);
  }

  /**
   * Save config.
   * @param editor the editor component
   * @param file the file to save
   */
  saveConfig(editor: EditorComponent, file: File) {
    editor.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }

      const configuration = result.editorState.configuration;

      const editMode = file.editMode;
      const fileName = editor.getFileName();
      const filePath = editMode
        ? file.path
        : electronApi.path.resolve(file.parent.path, fileName);

      const fileContent = this.utilService.convertTreeToYaml(configuration);
      electronApi.saveFile(filePath, fileContent);

      if (!editMode) {
        delete this.editorStates[file.path];
      }

      file.ino = null;
      file.path = filePath;
      file.fileName = fileName;
      file.editMode = true;
      file.modified = false;
      file.configuration = configuration;
      file.originalConfig = _.cloneDeep(configuration);

      this.setEditorState(file);

      if (!file.parent.hasChild(filePath)) {
        file.parent.addChild(file);
        this.sortFolderChildren(file.parent);
        this.refreshFileExplorer();
      }

      if (!editMode) {
        this.resetNewFileIno();
        this.watchFile(file);
      }
    });
  }

  /**
   * Reset ino for new file.
   */
  private resetNewFileIno() {
    let ino = 0;
    this.openedFiles.forEach(file => {
      if (!file.editMode) {
        ino = Math.min(ino, file.ino || 0);
      }
    });
    this.newFileIno = ino - 1;
  }

  /**
   * Get folder's env file.
   * @param folder the folder to get its env file
   * @returns folder's env file
   */
  getEnvFile(folder: File) {
    return folder.children.find(
      f => f.fileName === percyConfig.environmentsFile
    );
  }

  /**
   * Check if file is env file.
   * @param file the file to check
   * @returns true if file is env file, false otherwise
   */
  isEnvFile(file: File) {
    return file.isFile && file.fileName === percyConfig.environmentsFile;
  }

  /**
   * Add new file.
   * @param folder the folder to add new file
   */
  addNewFile(folder: File) {
    if (!folder.folderPopulated) {
      this.populateFolder(folder);
    }
    const fileName = "Untitled" + this.newFileIno;
    const newFile = new File(
      electronApi.path.resolve(folder.path, fileName),
      fileName,
      true,
      folder
    );
    newFile.ino = this.newFileIno;
    newFile.applicationName = folder.applicationName;
    newFile.editMode = false;
    newFile.envFileMode = false;
    newFile.modified = true;
    newFile.configuration = new Configuration();
    newFile.environments = this.getEnvironments(folder.path);

    this.newFileIno--;

    this.openedFiles.push(newFile);
    this.setEditorState(newFile);
    this.selectedEditor.setValue(this.openedFiles.length - 1);
  }

  /**
   * Add env file.
   * @param folder the folder to add env file
   */
  addEnvironmentsFile(folder: File) {
    if (!folder.folderPopulated) {
      this.populateFolder(folder);
    }
    const envFile = this.getEnvFile(folder);
    if (envFile) {
      this.editFile(envFile);
      return;
    }

    const fileName = percyConfig.environmentsFile;
    const newFile = new File(
      electronApi.path.resolve(folder.path, fileName),
      fileName,
      true,
      folder
    );
    newFile.applicationName = folder.applicationName;
    newFile.editMode = false;
    newFile.envFileMode = true;
    newFile.modified = true;
    newFile.configuration = new Configuration();

    this.openedFiles.push(newFile);
    this.setEditorState(newFile);
    this.selectedEditor.setValue(this.openedFiles.length - 1);
  }

  /**
   * Close file editor.
   * @param file the file to close its editor
   * @param force the flag indicates whether to force closing editor even there is change
   */
  closeFile(file: File, force: boolean = false) {
    const found = this.findOpenedFile(file.path);
    if (!found) {
      return;
    }
    const index = this.openedFiles.indexOf(found);
    if (file.modified && !force) {
      this.selectTab(index);
      this.showUnsaveDialog(
        "Are you sure you want to close the file?"
      ).subscribe(res => {
        if (res) {
          this.doCloseFile(file, index);
        }
      });
    } else {
      this.doCloseFile(file, index);
    }
  }

  /**
   * Show unsaved dialog.
   * @param message the message to show
   */
  private showUnsaveDialog(message: string) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: `There may be unsaved changes.\n${message}`
      }
    });
    return dialogRef.afterClosed();
  }

  /**
   * Do close file.
   * @param file the file to close its editor
   * @param index the index of file within opened files
   */
  private doCloseFile(file: File, index: number) {
    if (file.editMode && file.modified) {
      file.modified = false;
      file.configuration = _.cloneDeep(file.originalConfig);
    }

    this.openedFiles.splice(index, 1);
    delete this.editorStates[file.path];

    if (this.selectedEditor.value === index) {
      if (index < this.openedFiles.length) {
        this.selectTab(index);
      } else {
        this.selectTab(index - 1);
      }
    }

    if (!file.editMode) {
      this.resetNewFileIno();
    } else {
      electronApi.unwatchFile(file.path);
    }
  }

  /**
   * Delete file.
   * @param the file to delete
   */
  deleteFile(file: File) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Delete ${file.applicationName}/${file.fileName} ?`
      }
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        electronApi.removeFile(file.path);

        this.closeFile(file, true);
        file.parent.removeChild(file.path);
        this.refreshFileExplorer();
      }
    });
  }

  /**
   * Parse yaml. Will hanle error if any.
   * @param content the yaml content
   * @param filePath the file path
   */
  private parseYaml(content: string, filePath: string) {
    try {
      return this.utilService.parseYamlConfig(content);
    } catch (err) {
      this.dialog.open(AlertDialogComponent, {
        data: {
          message: `Invalid yaml at ${filePath}:\n${err.message}`
        }
      });
      throw err;
    }
  }

  /**
   * Open right click context menu in file explorer.
   * @param event the event
   * @param menuTrigger the menu trigger
   */
  openMenu(event, menuTrigger) {
    event.preventDefault();
    menuTrigger.style.left = event.layerX + "px";
    menuTrigger.style.top =
      event.layerY + menuTrigger.offsetParent.scrollTop + "px";
    menuTrigger.click();
  }

  /**
   * Open right click context menu in file explorer.
   * @param event the event
   * @param menuButton the menu button
   */
  buttonOpenMenu(event, menuButton) {
    event.preventDefault();
    event.stopPropagation();
    menuButton._elementRef.nativeElement.click();
  }
}
