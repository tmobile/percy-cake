import { Component, OnInit, OnDestroy, HostListener, ViewChild, AfterViewInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatInput } from '@angular/material';
import { of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from 'store';
import { Alert } from 'store/actions/common.actions';
import { CommitChanges, SaveDraft } from 'store/actions/backend.actions';
import {
  PageLoad, ConfigurationChange,
} from 'store/actions/editor.actions';

import { appPercyConfig } from 'config';

import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';
import { UtilService, NotEmpty } from 'services/util.service';

import { NestedConfigViewComponent } from 'components/nested-config-view/nested-config-view.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';

/*
  Configurations editor page
  for both editing existing files and adding new ones
 */
@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit, OnDestroy, AfterViewInit {
  appName = '';
  filename = new FormControl('', [NotEmpty]);

  environments = this.store.pipe(select(appStore.getEnvironments));
  configFile = this.store.pipe(select(appStore.getConfigFile));
  configuration = this.store.pipe(select(appStore.getConfiguration));
  isCommitting = this.store.pipe(select(appStore.getIsCommitting));
  isSaving = this.store.pipe(select(appStore.getIsSaving));
  isPageDirty$ = this.store.pipe(select(appStore.getIsPageDirty));

  editMode = false;
  envFileMode = false;
  isPageDirty = false;

  showAsCode: boolean;
  previewCode: string;
  selectedNode: TreeNode;
  showAsCompiledYAMLEnvironment: string;
  currentConfigProperty: ConfigProperty;

  @ViewChild('fileNameInput') fileNameInput: MatInput;

  @ViewChild('nestedConfig') nestedConfig: NestedConfigViewComponent;

  @HostListener('window:beforeunload', ['$event'])
  onLeavePage($event: any) {
    if (this.isPageDirty) {
      $event.returnValue = true;
    }
  }

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
   * Initializes the component.
   */
  ngOnInit() {
    // get file content if it's in edit mode
    const routeSnapshot = this.route.snapshot;
    this.editMode = routeSnapshot.data.editMode;
    this.envFileMode = routeSnapshot.data.envFileMode;
    this.isPageDirty = !this.editMode;

    const applicationName = this.appName = routeSnapshot.paramMap.get('appName');
    const fileName = this.editMode || this.envFileMode ? routeSnapshot.paramMap.get('fileName') : null;
    if (fileName) {
      this.filename.setValue(fileName);
      this.filename.disable();
    } else {
      this.filename.setValue('');
    }

    this.store.dispatch(new PageLoad({ fileName, applicationName, editMode: this.editMode }));

    this.isPageDirty$.subscribe(res => {
      this.isPageDirty = res;
    });
  }

  /**
   * Hook invoked after view init.
   */
  ngAfterViewInit() {
    if (!this.filename.value && this.filename.enabled) {
      setImmediate(() => {
        this.fileNameInput.focus();
      });
    }
  }

  /**
   * Hook invoked when component destroy.
   */
  ngOnDestroy() {
    // Reset appPercyConfig
    _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);
  }

  /**
   * File name change handler.
   */
  fileNameChange() {
    if (!this.editMode) {
      if (this.filename.invalid) {
        return;
      }

      // Check whether the file name already exists
      this.store.pipe(select(appStore.backendState), take(1), tap((backendState) => {
        if (_.find(backendState.files.entities, { fileName: this.getFileName(), applicationName: this.appName })) {
          this.filename.setErrors({ alreadyExists: true });
        } else {
          this.filename.setErrors(undefined);
        }
      })).subscribe();
    }
  }

  /**
   * Get normalized file name.
   * @returns normalized file name.
   */
  private getFileName() {
    const name = _.trim(this.filename.value);
    return name.match(/\.[y|Y][a|A]?[m|M][l|L]$/) ? name : name + '.yaml';
  }

  /**
   * Checks if component can be deactivated
   * @returns true component can be deactivated, false otherwise
   */
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

  /**
   * Validate before save/commit.
   * @return validation result.
   */
  private validate() {
    // check the file name
    if (!this.editMode && this.filename.invalid) {
      this.fileNameInput.focus();
      return of({ editorState: null, valid: false });
    }

    return this.store.pipe(select(appStore.editorState), take(1), map((editorState) => {

      // verify yaml
      try {
        this.utilService.convertTreeToYaml(editorState.configuration);
        _.forEach(editorState.configuration.environments.children, (envNode) => {
          this.utilService.compileYAML(envNode.key, editorState.configuration);
        });
      } catch (err) {
        this.store.dispatch(new Alert({ message: `YAML validation failed:\n${err.message}`, alertType: 'error' }));
        return { editorState, valid: false };
      }

      return { editorState, valid: true };
    }));
  }

  /**
   * Save draft config.
   */
  saveConfig() {
    this.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }
      const editorState = result.editorState;

      const file = { ...editorState.configFile };
      file.fileName = this.getFileName();
      file.applicationName = this.appName;
      file.draftConfig = editorState.configuration;

      this.store.dispatch(new SaveDraft({ file, redirect: true }));
    });
  }

  /**
   * Commit file.
   */
  commitFile() {
    this.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }

      const editorState = result.editorState;

      const file = { ...editorState.configFile };
      file.fileName = this.getFileName();
      file.applicationName = this.appName;
      file.draftConfig = editorState.configuration;

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

  /**
   * Handles the configuration change.
   * @param configuration the new configuration
   */
  onConfigChange(configuration) {
    this.store.dispatch(new ConfigurationChange(configuration));
  }

  /**
   * Reset UI elements.
   */
  private reset() {
    this.showAsCode = false;
    this.previewCode = null;
    this.selectedNode = null;
    this.showAsCompiledYAMLEnvironment = null;
    this.currentConfigProperty = null;
  }

  /**
   * Handles the node selected request to show the detail.
   * @param node the selected node
   */
  onNodeSelected(node: TreeNode) {
    this.reset();

    this.selectedNode = node;
    this.showAsCode = !node.isLeaf();

    if (this.showAsCode) {
      const tree = new TreeNode('');
      tree.children.push(node);
      try {
        this.previewCode = this.utilService.convertTreeToYaml(tree);
      } catch (err) {
        this.store.dispatch(new Alert({ message: err.message, alertType: 'error' }));
      }
    }
  }

  /**
   * Handles the open add/edit property request.
   * @param property the property to add/edit
   */
  onAddEditProperty(property: ConfigProperty) {
    this.reset();
    this.currentConfigProperty = property;
  }

  /**
   * Handles the cancel add/edit property request.
   */
  onCancelAddEditProperty() {
    this.reset();
  }

  /**
   * Handles the save add/edit property request.
   */
  onSaveAddEditProperty(node: TreeNode) {
    this.nestedConfig.saveAddEditProperty(node);
    this.reset();
  }

  /**
   * Handles the edit node request.
   * @param node the node to edit
   */
  openEditPropertyDialog(node: TreeNode) {
    this.nestedConfig.openEditPropertyDialog(node);
  }

  /**
   * Handles the compiled YAML view request.
   * @param environment the environment to compile its yaml
   */
  showCompiledYAML(environment: string) {
    this.store.pipe(select(appStore.editorState), take(1), tap(editorState => {
      try {
        const compiledYAML = this.utilService.compileYAML(environment, editorState.configuration);
        this.reset();
        this.showAsCompiledYAMLEnvironment = environment;
        this.previewCode = compiledYAML;
      } catch (err) {
        this.store.dispatch(new Alert({ message: err.message, alertType: 'error' }));
      }
    })).subscribe();
  }

}
