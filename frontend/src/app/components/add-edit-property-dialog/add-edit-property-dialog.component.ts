import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from '../../config/index';
import { ConfigProperty } from '../../models/config-property';
import { UtilService } from '../../services/util.service';
import { TreeNode } from '../../models/tree-node';

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
  @Input() data: any;
  @Output() saveProperty = new EventEmitter<TreeNode>();
  @Output() cancel = new EventEmitter<any>();
  formDirty = false;
  valueTypeOptions = _.values(PROPERTY_VALUE_TYPES);
  key: FormControl;
  valueType: FormControl;
  value: FormControl;
  comment: FormControl;

  inheritsOptions: string[];

  duplicateDefault: false;

  constructor(private utilService: UtilService) {

    this.key = new FormControl('', [Validators.required]);
    this.valueType = new FormControl('', [Validators.required]);
    this.value = new FormControl('', [Validators.required]);
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
    this.inheritsOptions = null;

    const node: TreeNode = this.data.node;

    if (this.data.editMode) {
      const { configProperty } = this.data;

      this.key.setValue(configProperty.key);
      this.valueType.setValue(configProperty.valueType);

      if (configProperty.valueType === PROPERTY_VALUE_TYPES.BOOLEAN) {
        this.value.setValue(configProperty.value !== undefined ? configProperty.value.toString() : '');
      } else {
        this.value.setValue(configProperty.value ? configProperty.value : '');
      }

      this.comment.setValue(configProperty.comment ? configProperty.comment : '');
    } else {
      if (node.isArray()) {
        this.key.setValue(`[${node.children.length}]`);
        this.valueType.setValue(node.getArrayItemType());
      }
    }

    if (this.keyDisabled()) {
      this.key.disable();
    }

    if (this.valueTypeDisabled()) {
      this.valueType.disable();
    }
  }

  showInherits() {
    const result = !this.data.isDefaultNode && this.key.value === 'inherits'
      && ((!this.data.editMode && this.data.node.level === 1) || (this.data.editMode && this.data.node.level === 2));

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
    if (this.data.node.level === 1) {
      envsNode = this.data.node.parent;
      thisEnvKey = this.data.node.key;
    } else if (this.data.node.level === 2) {
      envsNode = this.data.node.parent.parent;
      thisEnvKey = this.data.node.parent.key;
    } else {
      return [];
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
        inherited = _.find(envsNode.children, {key: inheritedEnv.value});
      }
    };
    return envsNode.children.filter(child => child.key !== thisEnvKey && !hasCylic(child)).map(child => child.key);
  }

  isEditArrayItem() {
    const node: TreeNode = this.data.node;

    return (this.data.editMode && node.parent && node.parent.isArray()) || (!this.data.editMode && node.isArray());
  }

  isEditRootNode() {
    return this.data.editMode && !this.data.node.parent;
  }

  keyDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() || (this.data.editMode && !this.data.isDefaultNode);
  }

  valueTypeDisabled() {
    return this.isEditRootNode() || this.isEditArrayItem() || !this.data.isDefaultNode;
  }

  getBreadCrumb() {
    if (this.data.editMode) {
      return `${this.data.node.getBreadCrumb('')}${this.key.value}`;
    }
    return `${this.data.node.getBreadCrumb()} / ${this.key.value ? this.key.value : ''}`;
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

  /*
    submit the property form with new/updated property values
   */
  onSubmit() {
    this.formDirty = true;

    // check form validity
    if (
      (this.key.disabled ? true : this.key.valid) &&
      (this.valueType.disabled ? true : this.valueType.valid) &&
      (!TreeNode.isLeafType(this.valueType.value) || this.value.disabled ? true : this.value.valid)
    ) {
      if (!this.duplicateDefault) {
        const property = new ConfigProperty();
        property.key = this.key.value;
        property.valueType = this.valueType.value;
        property.comment = this.comment.value;
        property.value = this.value.value;

        // omit empty values and send the response and close the dialog
        this.saveProperty.emit(this.utilService.convertToTreeNode(property));
      } else {
        // Build key hierarchy
        const keyHierarchy = [];
        let node = this.data.node;
        while (node && node.level > 1) {
          keyHierarchy.unshift(node.key);
          node = node.parent;
        }

        const keyValue = this.key.value;
        if (!this.data.editMode && this.data.node.level >= 1) {
          keyHierarchy.push(keyValue);
        }

        // Find the respective defalut node
        let defaultNode = this.data.defaultNode;
        for (let i = 0; i < keyHierarchy.length; i++) {
          defaultNode = _.find(defaultNode.children, { key: keyHierarchy[i] });
        }

        // Clone default node by rebuilding it
        const result = this.utilService.buildConfigTree(
          defaultNode.jsonValue,
          this.data.editMode ? this.data.node.level : this.data.node.level + 1,
          keyValue,
          this.data.editMode ? this.data.node.parent : this.data.node);

        this.saveProperty.emit(result);
      }
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  isChecked(value, flag) {
    return value === flag;
  }
}
