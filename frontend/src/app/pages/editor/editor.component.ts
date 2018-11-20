import { Component, OnInit, HostListener, ViewChild, Inject, ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatInput } from '@angular/material';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from '../../store';
import { TreeNode } from '../../models/tree-node';
import { Configuration, ConfigFile } from '../../models/config-file';
import { NestedConfigViewComponent } from '../../components/nested-config-view/nested-config-view.component';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from '../../components/commit-dialog/commit-dialog.component';
import { Alert } from '../../store/actions/common.actions';
import {
  PageLoad, ViewCompiledYAML, OpenAddEditProperty,
  CancelAddEditProperty, SaveAddEditProperty, ConfigurationChange,
  NodeSelected,
  SaveFile,
  ChangeFileName,
} from '../../store/actions/editor.actions';
import { GetConfigFile } from '../../store/reducers/backend.reducers';
import { CommitChanges } from '../../store/actions/backend.actions';

/*
  Configurations editor page
  for both editing existing files and adding new ones
 */
@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit {
  isPageDirty$ = this.store.pipe(select(appStore.getIsPageDirty));
  isPageDirty = false;
  appName = '';
  filename = new FormControl('', [Validators.required]);

  environments: Observable<string[]> = this.store.pipe(select(appStore.getEnvironments));

  // only if its in edit mode
  filePath: Observable<string> = this.store.pipe(select(appStore.getFilePath));
  configuration: Observable<Configuration> = this.store.pipe(select(appStore.getConfiguration));
  selectedNode = this.store.pipe(select(appStore.getSelectedNode));
  showAsCode = this.store.pipe(select(appStore.getShowAsCode));
  showAsCompiledYAMLEnvironment = this.store.pipe(select(appStore.getShowAsCompiledYAMLEnvironment));
  previewCode = this.store.pipe(select(appStore.getPreviewCode));
  currentAddEditProperty = this.store.pipe(select(appStore.getCurrentAddEditProperty));
  selectedConfigProperty = this.store.pipe(select(appStore.getSelectedConfigProperty));
  isCommitting = this.store.pipe(select(appStore.getIsCommitting));
  isEditMode = false;
  isEnvMode = false;

  disableSaveDraft = this.isPageDirty$.pipe(map(() => {
    if (!this.isEditMode) {
      return false;
    }
    return !this.isPageDirty;
  }));

  disableCommit = this.store.pipe(select(appStore.editorState)).pipe(map(editorState => {
    const config = editorState.configuration;

    if (_.isEqual(config, editorState.originalConfiguration)) {
      return true;
    }
    return false;
  }));

  @ViewChild('fileNameInput') fileNameInput: MatInput;

  @ViewChild('nestedConfig') nestedConfig: NestedConfigViewComponent;

  @ViewChild('detailPanel') detailPanel: ElementRef;

  @HostListener('window:beforeunload', ['$event'])
  onLeavePage($event: any) {
    if (this.isPageDirty) {
      $event.returnValue = true;
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const paddingTop = this.document.documentElement.scrollTop - 150;

    if (this.detailPanel && this.detailPanel.nativeElement) {
      if (paddingTop > 0) {
        this.detailPanel.nativeElement.style['padding-top'] = paddingTop + 'px';
      } else {
        this.detailPanel.nativeElement.style['padding-top'] = '0';
      }
    }
  }

  constructor(
    private route: ActivatedRoute,
    private store: Store<appStore.AppState>,
    private dialog: MatDialog,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit() {
    // get file content if its in edit mode
    const routeSnapshot = this.route.snapshot;
    this.isEditMode = routeSnapshot.data.inEditMode;
    this.isEnvMode = routeSnapshot.data.inEnvMode;
    this.appName = routeSnapshot.paramMap.get('appName');
    const fileName = this.isEditMode || this.isEnvMode ? routeSnapshot.paramMap.get('fileName') : null;
    this.store.dispatch(new PageLoad({ inEditMode: this.isEditMode, inEnvMode: this.isEnvMode, appName: this.appName, fileName }));
    if (fileName) {
      this.filename.setValue(fileName);
      this.filename.disable();
    } else {
      this.filename.setValue('');
      this.fileNameInput.focus();
    }
    this.isPageDirty$.subscribe(res => {
      this.isPageDirty = res;
    });
  }

  fileNameChange() {
    if (!this.isEditMode) {
      this.store.pipe(select(appStore.backendState)).pipe(take(1), tap((backendState) => {
        if (!this.filename.value) {
          return;
        }

        if (_.find(backendState.files.entities, {fileName: this.getFileName(), applicationName: this.appName})) {
          this.filename.setErrors({alreadyExists: true});
        } else {
          this.filename.setErrors(undefined);
        }

      })).subscribe();
    }

    this.store.dispatch(new ChangeFileName(this.getFileName()));
  }

  private getFileName() {
    return this.filename.value.match(/\.[y|Y][a|A]?[m|M][l|L]$/) ? this.filename.value : this.filename.value + '.yaml';
  }

  // checks if component can be deactivated
  canDeactivate() {
    if (this.isPageDirty) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          confirmationText: 'There may be unsaved changes. Are you sure you want to navigate?'
        }
      });
      return dialogRef.afterClosed().pipe(map(response => response));
    }
    return true;
  }

  // handles the configuration change request
  onConfigChange(configuration) {
    this.store.dispatch(new ConfigurationChange(configuration));
  }

  private checkFileName() {
    return this.store.pipe(select(appStore.getAppState)).pipe(take(1), map((appState) => {
      if (!this.isEditMode && this.filename.invalid) {
        this.fileNameInput.focus();
        return {appState, valid: false};
      }
      return {appState, valid: true};
    }));
  }

  /*
   * save the config if it has been changed
   */
  saveConfig() {
    this.checkFileName().subscribe(result => {
      if (!result.valid) {
        return;
      }
      this.store.dispatch(new SaveFile({redirectToDashboard: true}));
    });
  }

  /**
   * Commit file.
   */
  commitFile() {
    this.checkFileName().subscribe(result => {
      if (!result.valid) {
        return;
      }

      const appState = result.appState;
      const fileName = appState.editor.fileName;
      const applicationName = appState.editor.appName;
      const draftConfig = appState.editor.configuration;

      if (_.isEqual(draftConfig, appState.editor.originalConfiguration)) {
        return this.store.dispatch(new Alert({ message: 'No changes made', editorType: 'info' }));
      }

      const file: ConfigFile = {
        fileName,
        applicationName,
        draftConfig,
      };

      const configFile = GetConfigFile(appState.backend, fileName, applicationName);
      if (configFile) {
        file.timestamp = configFile.timestamp;
      }

      const dialogRef = this.dialog.open(CommitDialogComponent);

      dialogRef.afterClosed().subscribe(response => {
        if (response) {
          this.store.dispatch(new CommitChanges({
            files: [file],
            message: response,
            fromEditor: true
          }));
        }
      });
    });
  }

  // handles the node selected request to show the detail
  onNodeSelected(node: TreeNode) {
    this.store.dispatch(new NodeSelected({ node }));
  }

  // handles the open add/edit property request
  onAddEditProperty(options) {
    this.store.dispatch(new OpenAddEditProperty({ options }));
  }

  // handles the cancel add/edit property request
  onCancelAddEditProperty() {
    this.store.dispatch(new CancelAddEditProperty());
  }

  // handles the save add/edit property request
  onSaveAddEditProperty(node: TreeNode) {
    this.nestedConfig.saveAddEditProperty(node);
    this.store.dispatch(new SaveAddEditProperty({ node }));
  }

  // handles the compiled YAML view request
  showCompiledYAML(environment: string) {
    this.store.dispatch(new ViewCompiledYAML({ environment }));
  }

}
