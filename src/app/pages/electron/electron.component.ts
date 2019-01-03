import * as path from 'path';
import * as _ from 'lodash';
import { Subscription } from 'rxjs';

import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource, MatDialog } from '@angular/material';
import { Store, select } from '@ngrx/store';

import { electronApi, percyConfig, appPercyConfig } from 'config';
import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';

import * as appStore from 'store';
import { PageRestore } from 'store/actions/editor.actions';
import { LoadFilesSuccess, Initialize } from 'store/actions/backend.actions';
import { State as EditorState } from 'store/reducers/editor.reducer';
import { UtilService } from 'services/util.service';

import { EditorComponent } from 'components/editor/editor.component';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';

import { File } from '../../../../electron/File';
import { map } from 'rxjs/operators';

/**
 * Electron local folder/files editor compoent. It supports multiple editors for multiple files.
 */
@Component({
  selector: 'app-electron',
  templateUrl: './electron.component.html',
  styleUrls: ['./electron.component.scss']
})
export class ElectronAppComponent implements OnInit, OnDestroy {
  fileTreeControl: NestedTreeControl<File>;
  fileDataSource: MatTreeNestedDataSource<File>;

  allFiles: File[] = [];
  openedFiles: File[] = [];
  selectedEditor = new FormControl(0);

  editorStates: { [key: number]: EditorState } = {};

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
    private utilService: UtilService,
  ) { }

  /**
   * Initialize component.
   */
  ngOnInit() {
    this.utilService.initConfig();

    this.sub = this.store.pipe(select(appStore.editorState)).subscribe((editorState) => {
      if (!editorState.configFile) {
        return;
      }
      const id = editorState.configFile['id'];
      if (!id) {
        return;
      }

      // Align editor state
      const state = this.editorStates[id];
      if (state) {
        state.configuration = editorState.configuration;
      }

      // Align file state
      const file = this.findOpenedFile(id);
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
    this.store.dispatch(new Initialize({ redirectUrl: '' }));
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
    const folder = routeSnapshot.paramMap.get('folder');

    this.fileDataSource = new MatTreeNestedDataSource();

    const _getChildren = (node: File) => node.children;
    this.fileTreeControl = new NestedTreeControl<File>(_getChildren);

    this.refreshFolder(folder);
    this.fileDataSource.data[0].expanded = true;
  }

  /**
   * Prevent window unload when there is any change.
   */
  @HostListener('window:beforeunload', ['$event'])
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
      return this.showUnsaveDialog('Are you sure you want to navigate away from the page?').pipe(map(response => response));
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
    window.dispatchEvent(new Event('resize'));
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
   * Get all folders rescursively.
   * @param folder the root folder
   * @returns all folders
   */
  private getAllFolders(folders: File[]) {
    const result: {[key: string]: File} = {};
    if (!folders) {
      return result;
    }
    folders.forEach(folder => {
      if (!folder.isFile) {
        result[folder.path] = folder;
        const nested = this.getAllFolders(folder.children);
        _.assign(result, nested);
      }
    });
    return result;
  }

  /**
   * Refresh folder.
   * @param folderPath the folder path
   */
  refreshFolder(folderPath: string) {
    const folders = this.getAllFolders(this.fileDataSource.data);

    const setExpanded = (_folders: File[]) => {
      _folders.forEach(_folder => {
        if (!_folder.isFile) {
          if (folders[_folder.path]) {
            _folder.expanded = folders[_folder.path].expanded;
          }
          setExpanded(_folder.children);
        }
      });
    };

    const newFolder = electronApi.readFolder(folderPath);
    setExpanded([newFolder]);

    this.fileDataSource.data = [newFolder];

    this.setBackendState();
  }

  /**
   * Get file title.
   * @param file the file
   * @returns file title
   */
  getFileTitle(file: File) {
    let result = file.modified ? '*' + file.fileName : file.fileName;

    if (file.editMode && !_.find(this.allFiles, f => f.id === file.id)) {
      result += ' (deleted from disk)';
    }

    return result;
  }

  /**
   * Refresh file explorer.
   */
  private refreshFileExplorer() {
    const data = this.fileDataSource.data;
    this.fileDataSource.data = null;
    this.fileDataSource.data = data;
  }

  /**
   * Toggle folder.
   * @param folder the folder to toggle
   */
  toggle(folder: File) {
    folder.expanded = !folder.expanded;
    this.refreshFileExplorer();
  }

  /**
   * Find opened file.
   * @param id The file id
   * @returns found file
   */
  private findOpenedFile(id: string) {
    return this.openedFiles.find(f => f.id === id);
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

    const opened = this.findOpenedFile(file.id);
    if (!opened) {
      // Parse environments
      const envPath = path.resolve(path.dirname(file.path), percyConfig.environmentsFile);
      const envContent = electronApi.readFile(envPath);
      if (envContent) {
        const envConfig = this.parseYaml(envContent, envPath);
        file.environments = _.map(_.get(envConfig.environments, 'children', <TreeNode[]>[]), child => child.key);
      } else {
        file.environments = [];
      }

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
    electronApi.watchFile(filePath, this.utilService.wrapInZone((event) => {
      if (event === 'deleted') {
        this.refreshFolder(this.fileDataSource.data[0].path);
      } else if (event === 'changed') {

        const _file = this.findOpenedFile(file.id);
        if (_file) {

          const _fileContent = electronApi.readFile(filePath);
          const originalConfig = this.parseYaml(_fileContent, filePath);
          if (!_.isEqual(originalConfig, _file.originalConfig)) {

            const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
              data: {
                confirmationText: `${filePath} is changed externally. Do you want to reload the file?`
              }
            });
            dialogRef.afterClosed().subscribe(res => {
              if (res) {
                _file.originalConfig = originalConfig;
                _file.configuration = _.cloneDeep(originalConfig);
                _file.modified = false;
                this.setEditorState(_file);
              }
            });
          }
        }
      }
    }));
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
   * Set backend state.
   */
  private setBackendState() {
    const folders = this.fileDataSource.data;
    this.allFiles = this.getAllFiles(folders);
    this.store.dispatch(new LoadFilesSuccess({ files: this.allFiles, applications: [] }));
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
      isPageDirty: false,
    };
    this.editorStates[file.id] = state;
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
      this.store.dispatch(new PageRestore(this.editorStates[file.id]));
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
      const filePath = editMode ? file.path : path.resolve(file.parent.path, fileName);

      const fileContent = this.utilService.convertTreeToYaml(configuration);
      const ino = electronApi.saveFile(filePath, fileContent);

      if (!editMode) {
        delete this.editorStates[file.id];
      }

      file.ino = ino;
      file.path = filePath;
      file.fileName = fileName;
      file.editMode = true;
      file.modified = false;
      file.configuration = configuration;
      file.originalConfig = _.cloneDeep(configuration);
      File.setId(file);

      this.setEditorState(file);

      if (!editMode) {
        this.resetNewFileIno();
        this.refreshFolder(this.fileDataSource.data[0].path);
        this.watchFile(file);
      } else if (!_.find(this.allFiles, f => f.id === file.id)) {
        this.refreshFolder(this.fileDataSource.data[0].path);
      }
    });
  }

  /**
   * Add new file.
   * @param folder the folder to add new file
   */
  addNewFile(folder: File) {
    const newFile = new File(folder.path, 'Untitled' + this.newFileIno, true, this.newFileIno, folder);
    newFile.applicationName = folder.applicationName;
    newFile.editMode = false;
    newFile.envFileMode = false;
    newFile.modified = true;
    newFile.configuration = new Configuration();

    this.newFileIno--;

    this.openedFiles.push(newFile);
    this.setEditorState(newFile);
    this.selectedEditor.setValue(this.openedFiles.length - 1);
  }

  /**
   * Reset ino for new file.
   */
  private resetNewFileIno() {
    let ino = 0;
    this.openedFiles.forEach(file => {
      if (!file.editMode) {
        ino = Math.min(ino, file.ino);
      }
    });
    this.newFileIno = ino - 1;
  }

  /**
   * Close file editor.
   * @param file the file to close its editor
   * @param force the flag indicates whether to force closing editor even there is change
   */
  closeFile(file: File, force: boolean = false) {
    const found = this.findOpenedFile(file.id);
    if (!found) {
      return;
    }
    const index = this.openedFiles.indexOf(found);
    if (file.modified && !force) {
      this.selectTab(index);
      this.showUnsaveDialog('Are you sure you want to close the file?').subscribe((res) => {
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
    delete this.editorStates[file.id];

    if (index < this.openedFiles.length) {
      this.selectTab(index);
    } else {
      this.selectTab(index - 1);
    }

    if (!file.editMode) {
      this.resetNewFileIno();
    } else {
      electronApi.unwatchFile(file.path);
    }
  }

  /**
   * Check if folder has env file.
   * @param folder the folder to check
   * @returns true if folder has env file, false otherwise
   */
  hasEnvFile(folder: File) {
    return !!folder.children.find(f => f.fileName === percyConfig.environmentsFile);
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
   * Add env file.
   * @param folder the folder to add env file
   */
  addEnvironmentsFile(folder: File) {
    const newFile = new File(folder.path, percyConfig.environmentsFile, true, null, folder);
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
        this.refreshFolder(this.fileDataSource.data[0].path);
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
    menuTrigger.style.left = event.layerX + 'px';
    menuTrigger.style.top = event.Y + 'px';
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
