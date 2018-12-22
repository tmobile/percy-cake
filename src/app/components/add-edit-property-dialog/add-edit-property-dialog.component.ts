import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES, percyConfig } from 'config';
import * as appStore from 'store';
import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';
import { Alert } from 'store/actions/common.actions';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { NotEmpty } from 'services/validators';

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
  duplicateFirstSibling = false;
  autoTrim = true;

  /**
   * constructs the component
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param store the application state store
   */
  constructor(
    private store: Store<appStore.AppState>,
    private dialog: MatDialog) {

    this.key = new FormControl('', [NotEmpty, Validators.pattern(percyConfig.propertyNameRegex)]);
    this.valueType = new FormControl('', [NotEmpty]);
    this.value = new FormControl('', [NotEmpty]);
    this.comment = new FormControl('');
  }

  /**
   * Called when component bound data changes.
   */
  ngOnChanges() {

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
      this.valueType.setValue(PROPERTY_VALUE_TYPES.OBJECT);
    }

    if (this.keyDisabled()) {
      this.key.disable();
    }

    if (this.valueTypeDisabled()) {
      this.valueType.disable();
    }
  }

  /**
   * Determine if key should be disabled.
   * @returns true if key should be disabled, false otherwise
   */
  keyDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() ||
      (this.data.editMode && !this.data.node.isDefaultNode() && !this.isDefineEnv());
  }

  /**
   * Determine if value type should be disabled.
   * @returns true if key should be disabled, false otherwise
   */
  valueTypeDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() || !this.data.node.isDefaultNode();
  }

  /**
   * Determine if user is adding/editing environment in environment.yaml file.
   * @returns true if user is defining environment, false otherwise
   */
  isDefineEnv() {
    if (!this.data.envFileMode || this.data.node.isDefaultNode()) {
      return false;
    }
    return (this.data.editMode && this.data.node.getLevel() === 1) || (!this.data.editMode && this.data.node.getLevel() === 0);
  }

  /**
   * Determine if user is editing an item within array.
   * @returns true if user is editing an item within array, false otherwise
   */
  isEditArrayItem() {
    const node: TreeNode = this.data.node;

    return (this.data.editMode && node.parent && node.parent.isArray()) || (!this.data.editMode && node.isArray());
  }

  /**
   * Determine if user is editing a non-first object item within array.
   * @returns true if user is editing a non-first object item within array, false otherwise
   */
  isNonFirstObjectInArray() {
    const node: TreeNode = this.data.node;

    return (this.data.editMode && node.isObjectInArray() && node.parent.children.indexOf(node) > 0)
      || (!this.data.editMode && node.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY && node.children.length > 0);
  }

  /**
   * Determine if user is editing the root node.
   * @returns true if user is editing the root node, false otherwise
   */
  isEditRootNode() {
    return this.data.editMode && !this.data.node.parent;
  }

  /**
   * Determine if the inherits options should be shown.
   * Will also generate the inherits options.
   *
   * @returns true if user is inherits options should be shown, false otherwise
   */
  showInherits() {
    const result = !this.data.node.isDefaultNode() && this.key.value === 'inherits'
      && ((!this.data.editMode && this.data.node.getLevel() === 1) || (this.data.editMode && this.data.node.getLevel() === 2));

    if (result) {
      if (!this.inheritsOptions) {
        this.inheritsOptions = this.constructInheritsOptions();
      }
      this.useDefault(false);
    }

    return result;
  }

  /**
   * Construct inherits options available for user to choose from.
   * @returns inherits options
   */
  private constructInheritsOptions() {
    const envsRoot: TreeNode = this.data.node.getTopParent();
    let thisEnv;

    // Determine the current env
    if (this.data.node.getLevel() === 1) {
      thisEnv = this.data.node.key;
    } else {
      thisEnv = this.data.node.parent.key;
    }

    // Used to exclude the cylic options
    const hasCylic = (child) => {
      let inherited = child;
      while (inherited) {
        const inheritedEnv = _.find(inherited.children, c => c.key === 'inherits');
        if (!inheritedEnv) {
          break;
        }
        if (inheritedEnv.value === thisEnv) {
          return true;
        }
        inherited = _.find(envsRoot.children, { key: inheritedEnv.value });
      }
    };
    return envsRoot.children.filter(child => child.key !== thisEnv && !hasCylic(child)).map(child => child.key);
  }

  /**
   * Get bread crumb to display.
   * @returns bread crumb
   */
  getBreadCrumb() {
    const node: TreeNode = this.data.node;
    if (this.data.editMode) {
      return `${node.parent ? node.parent.getPathsString() + '.' : ''}${this.key.value}`;
    }
    return `${node.getPathsString()}${this.key.value ? '.' + this.key.value : ''}`;
  }

  /*
   * Set value type based on the selected key
   * @param key the selected key
   */
  setValueTypeOption(key: string) {
    this.valueType.setValue(_.find(this.data.keyOptions, { key })['type']);
  }

  /**
   * Checks to copy property from default tree.
   * @param $event user's check event
   */
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

  /**
   * Checks to copy properties from first sibling object item in array.
   * @param $event user's check event
   */
  useFirstSibling($event) {
    this.duplicateFirstSibling = $event && $event.checked;
    if (this.duplicateFirstSibling) {
      this.comment.disable();
    } else {
      this.comment.enable();
    }
  }

  /**
   * Checks to auto trim string value.
   * @param $event user's check event
   */
  useAutoTrim($event) {
    this.autoTrim = $event && $event.checked;
  }

  /*
   * Submit the property form with new/updated property values
   */
  onSubmit() {
    this.formDirty = true;

    //  trim key and comment irrespective of the auto trim option
    this.key.setValue(_.trim(this.key.value));
    this.comment.setValue(_.trim(this.comment.value));

    if (this.autoTrim) {
      if (this.valueType.value === PROPERTY_VALUE_TYPES.STRING) {
        this.value.setValue(_.trim(this.value.value));
      }
    }

    // check form validity
    const formValid =
      (this.key.disabled ? true : this.key.valid) &&
      (this.valueType.disabled ? true : this.valueType.valid) &&
      (!TreeNode.isLeafType(this.valueType.value) || this.value.disabled ? true : this.value.valid);

    if (!formValid) {
      return;
    }

    // Validate number is in range
    if (this.valueType.value === PROPERTY_VALUE_TYPES.NUMBER) {
      const num = this.value.value;
      if ((_.isInteger(num) && !_.isSafeInteger(num)) ||
        (num >= Number.MAX_SAFE_INTEGER || num <= Number.MIN_SAFE_INTEGER)) {
        this.value.setErrors({ range: true });
        return;
      }
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
          confirmationText: 'You have changed the property type, the corresponding property will be removed from all environments. Do you still want to make the change?' // tslint:disable-line
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

  /**
   * Do submit.
   */
  private doSubmit() {

    if (!this.duplicateDefault && !this.duplicateFirstSibling) {
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
    } else if (this.duplicateDefault) {
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
      const result = this.cloneWithoutParent(defaultTree);
      result.key = this.key.value;

      this.saveProperty.emit(result);
    } else {
      const firstSibling = this.data.editMode ? this.data.node.parent.children[0] : this.data.node.children[0];

      const result = this.cloneWithoutParent(firstSibling);
      result.key = this.key.value;
      this.saveProperty.emit(result);
    }
  }

  /**
   * Clone tree node without parent relationship.
   * @param node the node to clone
   * @return cloned node
   */
  private cloneWithoutParent(node: TreeNode) {

    const parent = node.parent;
    node.parent = undefined;
    const result = _.cloneDeep(node);
    node.parent = parent;
    return result;
  }

  /**
   * Cancel edit.
   */
  onCancel() {
    this.cancel.emit();
  }
}
