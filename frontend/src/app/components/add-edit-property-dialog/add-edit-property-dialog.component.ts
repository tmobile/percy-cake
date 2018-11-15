import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { values, find } from 'lodash';

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
  valueTypeOptions = values(PROPERTY_VALUE_TYPES);
  key: FormControl;
  valueType: FormControl;
  value: FormControl;
  comment: FormControl;

  inheritsOptions: string[];

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

    if (this.showInherits()) {
      this.inheritsOptions = this.getInheritsOptions();
    }
  }

  showInherits() {
    return !this.data.isDefaultNode && this.key.value === 'inherits'
      && ((!this.data.editMode && this.data.node.level === 1) || (this.data.editMode && this.data.node.level === 2))
      ? 'inherits' : 'string';
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
        const inheritedEnv = find(inherited.children, c => c.key === 'inherits');
        if (!inheritedEnv) {
          break;
        }
        if (inheritedEnv.value === thisEnvKey) {
          return true;
        }
        inherited = find(envsNode.children, {key: inheritedEnv.value});
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
    this.valueType.setValue(find(this.data.keyOptions, { key: value })['type']);
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
      (!TreeNode.isLeafType(this.valueType.value) ? true : this.value.valid)
    ) {
      const property = new ConfigProperty();
      property.key = this.key.value;
      property.valueType = this.valueType.value;
      property.comment = this.comment.value;
      property.value = this.value.value;

      // omit empty values and send the response and close the dialog
      this.saveProperty.emit(this.utilService.convertToTreeNode(property));
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  isChecked(value, flag) {
    return value === flag;
  }
}
