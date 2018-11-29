import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatInput } from '@angular/material';
import { map, take, tap } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from 'store';
import { Alert } from 'store/actions/common.actions';
import { CommitChanges, SaveDraft, GetFileContentSuccess, GetFileContent } from 'store/actions/backend.actions';
import {
  PageLoad, ConfigurationChange, 
  OpenAddEditProperty, CancelAddEditProperty, SaveAddEditProperty,
  ViewCompiledYAMLSuccess, NodeSelectedSuccess,
} from 'store/actions/editor.actions';
import { GetConfigFile } from 'store/reducers/backend.reducers';
import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';
import { NestedConfigViewComponent } from 'components/nested-config-view/nested-config-view.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { UtilService } from 'services/util.service';
import { ConfigFile } from 'models/config-file';

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
  appName = '';
  filename = new FormControl('', [Validators.required]);

  environments = this.store.pipe(select(appStore.getEnvironments));
  configFile = this.store.pipe(select(appStore.getConfigFile));
  configuration = this.store.pipe(select(appStore.getConfiguration));
  selectedNode = this.store.pipe(select(appStore.getSelectedNode));
  showAsCode = this.store.pipe(select(appStore.getShowAsCode));
  showAsCompiledYAMLEnvironment = this.store.pipe(select(appStore.getShowAsCompiledYAMLEnvironment));
  previewCode = this.store.pipe(select(appStore.getPreviewCode));
  currentConfigProperty = this.store.pipe(select(appStore.getCurrentConfigProperty));
  isCommitting = this.store.pipe(select(appStore.getIsCommitting));
  isSaving = this.store.pipe(select(appStore.getIsSaving));
  isPageDirty$ = this.store.pipe(select(appStore.getIsPageDirty));

  editMode = false;
  envFileMode = false;
  isPageDirty = false;

  @ViewChild('fileNameInput') fileNameInput: MatInput;

  @ViewChild('nestedConfig') nestedConfig: NestedConfigViewComponent;

  @ViewChild('detailPanel') detailPanel: ElementRef;

  @HostListener('window:beforeunload', ['$event'])
  onLeavePage($event: any) {
    if (this.isPageDirty) {
      $event.returnValue = true;
    }
  }

  constructor(
    private route: ActivatedRoute,
    private store: Store<appStore.AppState>,
    private dialog: MatDialog,
    private utilService: UtilService,
  ) { }

  ngOnInit() {
    // get file content if its in edit mode
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
      this.fileNameInput.focus();
    }

    this.store.dispatch(new PageLoad({ applicationName, editMode: this.editMode }));

    this.isPageDirty$.subscribe(res => {
      this.isPageDirty = res;
    });

    if (!this.editMode) {
      // Add new file, set an initial config
      const file: ConfigFile = {
        fileName,
        applicationName,
        draftConfig: {
          default: { $type: 'object' },
          environments: { $type: 'object' }
        },
        modified: true
      };
      this.store.dispatch(new GetFileContentSuccess({file, newlyCreated: true}));
    } else {
      this.store.select(appStore.backendState).pipe(take(1)).subscribe((backend) => {

        const file = GetConfigFile(backend, fileName, applicationName);

        if (file && (file.originalConfig || file.draftConfig)) { // Newly added (but uncommitted) file has only draft config
          this.store.dispatch(new GetFileContentSuccess({file}));
        } else {
          this.store.dispatch(new GetFileContent(file ? file : {fileName, applicationName}));
        }
      });
    }
  }

  fileNameChange() {
    if (!this.editMode) {
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

  private validate() {
    return this.store.pipe(select(appStore.editorState)).pipe(take(1), map((editorState) => {
      if (!this.editMode && this.filename.invalid) {
        this.fileNameInput.focus();
        return {editorState, valid: false};
      }
      try {
        this.utilService.convertJsonToYaml(editorState.configuration);
        _.forEach(editorState.configuration.environments, (envNode, envName) => {
          if (!this.utilService.isReservedKey(envName)) {
            this.utilService.compileYAML(envName, editorState.configuration);
          }
        });
      } catch (err) {
        this.store.dispatch(new Alert({message: `YAML validation failed:\n${err.message}`, alertType: 'error'}));
        return {editorState, valid: false};
      }

      return {editorState, valid: true};
    }));
  }

  /*
   * save the config if it has been changed
   */
  saveConfig() {
    this.validate().subscribe(result => {
      if (!result.valid) {
        return;
      }
      const editorState = result.editorState;

      const file = {...editorState.configFile};
      file.fileName = this.getFileName();
      file.applicationName = this.appName;
      file.draftConfig = editorState.configuration;

      this.store.dispatch(new SaveDraft({file, redirect: true}));
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

      const file = {...editorState.configFile};
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

  // handles the node selected request to show the detail
  onNodeSelected(node: TreeNode) {
    if (!node.isLeaf()) {
        const compiledYAML = this.utilService.convertJsonToYaml({[node.key]: node.jsonValue});
        this.store.dispatch(new NodeSelectedSuccess({ node, compiledYAML }));
    } else {
        this.store.dispatch(new NodeSelectedSuccess({ node, compiledYAML: null }));
    }
  }

  // handles the open add/edit property request
  onAddEditProperty(property: ConfigProperty) {
    this.store.dispatch(new OpenAddEditProperty({ property }));
  }

  // handles the cancel add/edit property request
  onCancelAddEditProperty() {
    this.store.dispatch(new CancelAddEditProperty());
  }

  // handles the save add/edit property request
  onSaveAddEditProperty(node: TreeNode) {
    if (this.nestedConfig.saveAddEditProperty(node)) {
      this.store.dispatch(new SaveAddEditProperty({ node }));
    }
  }

  // handles the compiled YAML view request
  showCompiledYAML(environment: string) {
    this.store.pipe(select(appStore.getConfiguration), take(1), tap(config => {
      try {
        const compiledYAML = this.utilService.compileYAML(environment, config);
        this.store.dispatch(new ViewCompiledYAMLSuccess({ environment, compiledYAML }));
      } catch (err) {
        this.store.dispatch(new Alert({message: err.message, alertType: 'error'}));
      }
    })).subscribe();
  }

}
