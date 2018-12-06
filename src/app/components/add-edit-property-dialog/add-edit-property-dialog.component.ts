import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from 'config';
import * as appStore from 'store';
import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';
import { Alert } from 'store/actions/common.actions';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { NotEmpty } from 'services/util.service';

/*
  add or edit new property in the environment configuration
  if its default environment then the property key is a text input
  and if its a custom environment then its a select dropdown
 */
@Component({
  selector: 'app-add-edit-property-dialog',
  templateUrl: './add-edit-property-dialog.component.html',
  styleUrls: ['./add-edit-property-dialog.component.scss']
})
export class AddEditPropertyDialogComponent implements OnChanges {
  @Input() data: ConfigProperty;
  @Output() saveProperty = new EventEmitter<TreeNode>();
  @Output() cancel = new EventEmitter<any>();
  formDirty = false;
  valueTypeOptions = _.values(PROPERTY_VALUE_TYPES);
  key: FormControl;
  valueType: FormControl;
  value: FormControl;
  comment: FormControl;

  inheritsOptions: string[];

  duplicateDefault = false;
  autoTrim = false;

  constructor(
    private store: Store<appStore.AppState>,
    private dialog: MatDialog) {

    this.key = new FormControl('', [NotEmpty]);
    this.valueType = new FormControl('', [NotEmpty]);
    this.value = new FormControl('', [NotEmpty]);
    this.comment = new FormControl('');
  }

  ngOnChanges() {

    this.key.reset();
    this.valueType.reset();
    this.value.reset();
    this.comment.reset();

    this.key.enable();
    this.valueType.enable();
    this.value.enable();
    this.comment.enable();

    this.duplicateDefault = false;
    this.autoTrim = false;
    this.inheritsOptions = null;

    const { editMode, node } = this.data;

    if (editMode) {

      this.key.setValue(node.key);
      this.valueType.setValue(node.valueType);

      if (node.valueType === PROPERTY_VALUE_TYPES.NUMBER) {
        this.value.setValue(_.isNumber(node.value) ? node.value : '');
      } else {
        this.value.setValue(_.toString(node.value));
      }

      this.comment.setValue(_.toString(node.getCommentStr()));
    } else {
      if (node.isArray()) {
        this.key.setValue(`[${node.children.length}]`);
        this.valueType.setValue(node.getArrayItemType());
      }
    }

    if (this.isDefineEnv()) {
      this.valueType.setValue('object');
    }

    if (this.keyDisabled()) {
      this.key.disable();
    }

    if (this.valueTypeDisabled()) {
      this.valueType.disable();
    }
  }

  keyDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() ||
      (this.data.editMode && !this.data.node.isDefaultNode() && !this.isDefineEnv());
  }

  valueTypeDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() || !this.data.node.isDefaultNode();
  }

  isDefineEnv() {
    if (!this.data.envFileMode || this.data.node.isDefaultNode()) {
      return false;
    }
    return (this.data.editMode && this.data.node.getLevel() === 1) || (!this.data.editMode && this.data.node.getLevel() === 0);
  }

  isEditArrayItem() {
    const node: TreeNode = this.data.node;

    return (this.data.editMode && node.parent && node.parent.isArray()) || (!this.data.editMode && node.isArray());
  }

  isEditRootNode() {
    return this.data.editMode && !this.data.node.parent;
  }

  showInherits() {
    const result = !this.data.node.isDefaultNode() && this.key.value === 'inherits'
      && ((!this.data.editMode && this.data.node.getLevel() === 1) || (this.data.editMode && this.data.node.getLevel() === 2));

    if (result) {
      if (!this.inheritsOptions) {
        this.inheritsOptions = this.getInheritsOptions();
      }
      this.useDefault(false);
    }

    return result;
  }

  private getInheritsOptions() {
    let envsNode;
    let thisEnvKey;
    if (this.data.node.getLevel() === 1) {
      envsNode = this.data.node.parent;
      thisEnvKey = this.data.node.key;
    } else {
      envsNode = this.data.node.parent.parent;
      thisEnvKey = this.data.node.parent.key;
    }

    const hasCylic = (child) => {
      let inherited = child;
      while (inherited) {
        const inheritedEnv = _.find(inherited.children, c => c.key === 'inherits');
        if (!inheritedEnv) {
          break;
        }
        if (inheritedEnv.value === thisEnvKey) {
          return true;
        }
        inherited = _.find(envsNode.children, { key: inheritedEnv.value });
      }
    };
    return envsNode.children.filter(child => child.key !== thisEnvKey && !hasCylic(child)).map(child => child.key);
  }

  getBreadCrumb() {
    const node: TreeNode = this.data.node;
    if (this.data.editMode) {
      return `${node.parent ? node.parent.getPathsString() + '.' : ''}${this.key.value}`;
    }
    return `${node.getPathsString()}${this.key.value ? '.' + this.key.value : ''}`;
  }

  /*
    set value type in other environments when key is selected
   */
  setValueTypeOption(value: string) {
    this.valueType.setValue(_.find(this.data.keyOptions, { key: value })['type']);
  }

  useDefault($event) {
    this.duplicateDefault = $event && $event.checked;
    if (this.duplicateDefault) {
      this.value.disable();
      this.comment.disable();
    } else {
      this.value.enable();
      this.comment.enable();
    }
  }

  useAutoTrim() {
    this.autoTrim = true;
  }

  /*
    submit the property form with new/updated property values
   */
  onSubmit() {
    this.formDirty = true;

    if (this.autoTrim) {
      this.key.setValue(_.trim(this.key.value));
      if (this.valueType.value === PROPERTY_VALUE_TYPES.STRING) {
        this.value.setValue(_.trim(this.value.value));
      }
      this.comment.setValue(_.trim(this.comment.value));
    }

    // check form validity
    const formValid =
      (this.key.disabled ? true : this.key.valid) &&
      (this.valueType.disabled ? true : this.valueType.valid) &&
      (!TreeNode.isLeafType(this.valueType.value) || this.value.disabled ? true : this.value.valid);

    if (!formValid) {
      return;
    }

    // Validate key is unique
    if (!this.data.editMode || this.data.node.isDefaultNode() || this.isDefineEnv()) {
      const existingKeys = [];
      if (!this.data.editMode) {
        const parent = this.data.node;
        _.each(parent.children, (child) => {
          existingKeys.push(child.key);
        });
      } else if (this.key.value !== this.data.node.key) {
        const parent = this.data.node.parent;
        _.each(parent.children, (child) => {
          if (child !== this.data.node) {
            existingKeys.push(child.key);
          }
        });
      }
      if (existingKeys.indexOf(this.key.value) > -1) {
        this.store.dispatch(new Alert({
          message: `Property key '${this.key.value}' already exists`,
          alertType: 'error'
        }));
        return;
      }
    }

    if (this.data.editMode && this.valueType.value !== this.data.node.valueType) {

      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          confirmationText: 'You have changed the property type, and the corresponding property will be removed from all environments. Do you still want to make the change?' // tslint:disable-line
        }
      });

      dialogRef.afterClosed().subscribe(response => {
        if (response) {
          this.doSubmit();
        }
      });

      return;
    }

    this.doSubmit();
  }

  private doSubmit() {

    if (!this.duplicateDefault) {
      const node = new TreeNode(this.key.value, this.valueType.value);

      if (node.isLeaf()) {
        if (node.valueType === PROPERTY_VALUE_TYPES.BOOLEAN) {
          node.value = this.value.value === 'true' || this.value.value === true;
        } else if (node.valueType === PROPERTY_VALUE_TYPES.NUMBER) {
          node.value = _.toNumber(this.value.value);
        } else {
          node.value = this.value.value;
        }
      }

      if (this.comment.value) {
        node.comment = this.comment.value.split('\n');
      }

      this.saveProperty.emit(node);
    } else {
      // Build key hierarchy
      const keyHierarchy = [];
      let node = this.data.node;
      while (node && node.getLevel() > 1) {
        keyHierarchy.unshift(node.key);
        node = node.parent;
      }

      const keyValue = this.key.value;
      if (!this.data.editMode && this.data.node.getLevel() >= 1) {
        keyHierarchy.push(keyValue);
      }

      // Find the respective defalut node
      let defaultTree = this.data.defaultTree;
      for (let i = 0; i < keyHierarchy.length; i++) {
        defaultTree = _.find(defaultTree.children, child => child.key === keyHierarchy[i]);
      }

      // Clone default node
      const parent = defaultTree.parent;
      defaultTree.parent = undefined;
      const result = _.cloneDeep(defaultTree);
      defaultTree.parent = parent;

      result.key = this.key.value;

      this.saveProperty.emit(result);
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
