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
      const ino = editorState.configFile['ino'];
      if (!ino) {
        return;
      }

      // Align editor state
      const state = this.editorStates[ino];
      if (state) {
        state.configuration = editorState.configuration;
      }

      // Align file state
      const file = this.findOpenedFile(ino);
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

    // Reset appPercyConfig
    _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);

    // Clear backend state
    this.store.dispatch(new Initialize({ redirectUrl: '' }));
  }

  /**
   * Hanldes route change to open different folder.
   */
  onRouteChange() {

    this.openedFiles = [];
    this.editorStates = {};

    const routeSnapshot = this.route.snapshot;
    const folder = routeSnapshot.paramMap.get('folder');

    this.fileDataSource = new MatTreeNestedDataSource();
    this.fileDataSource.data = [electronApi.readFolder(folder)];
    this.fileDataSource.data[0].expanded = true;

    const _getChildren = (node: File) => node.children;
    this.fileTreeControl = new NestedTreeControl<File>(_getChildren);

    this.setBackendState();
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
   * @param ino The file ino
   * @returns found file
   */
  private findOpenedFile(ino: number) {
    return this.openedFiles.find(f => f.ino === ino);
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

    const opened = this.findOpenedFile(file.ino);
    if (!opened) {
      // Parse environments
      const enfPath = path.resolve(path.dirname(file.path), percyConfig.environmentsFile);
      const envContent = electronApi.readFile(enfPath);
      if (envContent) {
        const envConfig = this.parseYaml(envContent, enfPath);
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
    } else {
      this.selectTab(this.openedFiles.indexOf(opened));
    }
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
    const files = this.getAllFiles(folders);
    this.store.dispatch(new LoadFilesSuccess({ files, applications: [] }));
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
    this.editorStates[file.ino] = state;
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
      this.store.dispatch(new PageRestore(this.editorStates[file.ino]));
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
        delete this.editorStates[file.ino];
      }

      file.ino = ino;
      file.path = filePath;
      file.fileName = fileName;
      file.editMode = true;
      file.modified = false;
      file.configuration = configuration;
      file.originalConfig = _.cloneDeep(configuration);

      this.setEditorState(file);

      if (!editMode) {
        file.parent.addChild(file);
        this.refreshFileExplorer();
        this.resetNewFileIno();
        this.setBackendState();
      }
    });
  }

  /**
   * Add new file.
   * @param folder the folder to add new file
   */
  addNewFile(folder: File) {
    const newFile = new File(folder.path, true);
    newFile.parent = folder;
    newFile.ino = this.newFileIno;
    newFile.fileName = 'Untitled' + this.newFileIno;
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
    const index = this.openedFiles.indexOf(file);
    if (index < 0) {
      return;
    }

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
    delete this.editorStates[file.ino];

    if (index < this.openedFiles.length) {
      this.selectTab(index);
    } else {
      this.selectTab(index - 1);
    }

    if (!file.editMode) {
      this.resetNewFileIno();
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
   * Add env file.
   * @param folder the folder to add env file
   */
  addEnvironmentsFile(folder: File) {
    const newFile = new File(folder.path, true);
    newFile.parent = folder;
    newFile.ino = this.newFileIno;
    newFile.fileName = percyConfig.environmentsFile;
    newFile.applicationName = folder.applicationName;
    newFile.editMode = false;
    newFile.envFileMode = true;
    newFile.modified = true;
    newFile.configuration = new Configuration();

    this.newFileIno--;

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

        file.parent.children = file.parent.children.filter(f => f !== file);

        this.refreshFileExplorer();
        this.closeFile(file, true);
        this.setBackendState();
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
