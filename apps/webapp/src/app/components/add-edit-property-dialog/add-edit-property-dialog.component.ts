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

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  ViewChild,
  ElementRef
} from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import * as _ from "lodash";

import { percyConfig } from "config";
import * as appStore from "store";
import { TreeNode, ConfigProperty, PROPERTY_VALUE_TYPES } from "models/tree-node";
import { Alert } from "store/actions/common.actions";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { NotEmpty } from "services/validators";

/*
  add or edit new property in the environment configuration
  if its default environment then the property key is a text input
  and if its a custom environment then its a select dropdown
 */
@Component({
  selector: "app-add-edit-property-dialog",
  templateUrl: "./add-edit-property-dialog.component.html",
  styleUrls: ["./add-edit-property-dialog.component.scss"]
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
  anchor: FormControl;
  alias: FormControl;
  @ViewChild("numberInput") numberInput: ElementRef;

  inheritsOptions: string[];
  anchorsOptions: string[];

  duplicateDefault = false;
  duplicateFirstSibling = false;
  autoTrim = true;

  /**
   * constructs the component
   *
   * @param dialogRef the reference to a dialog opened via the MatDialog service
   * @param store the application state store
   */
  constructor(
    private store: Store<appStore.AppState>,
    private dialog: MatDialog
  ) {
    this.key = new FormControl("", [
      NotEmpty,
      Validators.pattern(percyConfig.propertyNameRegex)
    ]);
    this.valueType = new FormControl("", [NotEmpty]);
    this.value = new FormControl("", [NotEmpty]);
    this.alias = new FormControl("", [NotEmpty]);
    this.anchor = new FormControl("", [
      NotEmpty,
      Validators.pattern("^[a-zA-Z0-9_-]*$"),
      Validators.maxLength(40)
    ]);
    this.comment = new FormControl("");
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
        this.value.setValue(
          _.isNumber(node.value) || _.isString(node.value) ? node.value : ""
        );
      } else {
        this.value.setValue(_.toString(node.value));
      }

      if (this.showAnchor()) {
        this.anchor.setValue(node.anchor);
      }
      if (this.showAlias()) {
        if (node.aliases && node.aliases.length) {
          this.alias.setValue(node.aliases[0]);
        }
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

    if (this.showAnchor() && !this.anchor.value) {
      // Set default anchor
      const nodePaths = editMode
        ? node.getPathsWithoutRoot().join("-")
        : `${node.getPathsWithoutRoot().join("-")}-${node.children.length}`;
      this.anchor.setValue(
        nodePaths
          .replace(/\[/g, "")
          .replace(/\]/g, "")
          .replace(/$/g, "")
          .replace(/\./g, "")
      );
    }
  }

  /**
   * Determine if key should be disabled.
   *
   * @returns true if key should be disabled, false otherwise
   */
  keyDisabled() {
    return (
      this.isEditRootNode() ||
      this.isEditArrayItem() ||
      (this.data.editMode &&
        !this.data.node.isDefaultNode() &&
        !this.isDefineEnv())
    );
  }

  /**
   * Determine if value type should be disabled.
   *
   * @returns true if key should be disabled, false otherwise
   */
  valueTypeDisabled() {
    return (
      this.isEditRootNode() ||
      this.isEditArrayItem() ||
      !this.data.node.isDefaultNode()
    );
  }

  /**
   * Determine if user is adding/editing environment in environment.yaml file.
   *
   * @returns true if user is defining environment, false otherwise
   */
  isDefineEnv() {
    if (!this.data.envFileMode || this.data.node.isDefaultNode()) {
      return false;
    }
    return (
      (this.data.editMode && this.data.node.getLevel() === 1) ||
      (!this.data.editMode && this.data.node.getLevel() === 0)
    );
  }

  /**
   * Determine if user is editing an item within array.
   *
   * @returns true if user is editing an item within array, false otherwise
   */
  isEditArrayItem() {
    const node: TreeNode = this.data.node;

    return (
      (this.data.editMode && node.parent && node.parent.isArray()) ||
      (!this.data.editMode && node.isArray())
    );
  }

  /**
   * Determine if user is editing a non-first object item within array.
   *
   * @returns true if user is editing a non-first object item within array, false otherwise
   */
  isNonFirstObjectInArray() {
    const node: TreeNode = this.data.node;

    return (
      (this.data.editMode &&
        node.isObjectInArray() &&
        node.parent.children.indexOf(node) > 0) ||
      (!this.data.editMode &&
        node.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY &&
        node.children.length > 0)
    );
  }

  /**
   * Determine if user is editing the root node.
   *
   * @returns true if user is editing the root node, false otherwise
   */
  isEditRootNode() {
    return this.data.editMode && !this.data.node.parent;
  }

  /**
   * Determine if the anchor should be shown.
   * Currently only support YAML anchor in object Array elements.
   *
   * @returns true if anchor should be shown, false otherwise
   */
  showAnchor() {
    const node = this.data.node;
    const result =
      node.isDefaultNode() &&
      ((this.data.editMode && node.isObjectInArray()) ||
        (!this.data.editMode &&
          node.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY));

    return result;
  }

  /**
   * Determine if the alias options should be shown.
   * Currently only support YAML anchor in object Array elements.
   *
   * @returns true if alias options should be shown, false otherwise
   */
  showAlias() {
    let node = this.data.node;
    const result =
      !node.isDefaultNode() &&
      ((this.data.editMode && node.isObjectInArray()) ||
        (!this.data.editMode &&
          node.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY));

    if (result) {
      if (!this.anchorsOptions) {
        this.anchorsOptions = [];
        if (this.data.editMode) {
          node = node.parent;
        }
        const paths = node.getPathsWithoutRoot().slice(1);
        const relatedNode = this.data.defaultTree.findChild(paths);
        if (relatedNode) {
          _.each(relatedNode.children, child => {
            if (child.anchor) {
              this.anchorsOptions.push(child.anchor);
            }
          });
        }
        if (this.anchorsOptions.length) {
          this.anchorsOptions.unshift("");
        }
      }
    }
    return result;
  }

  /**
   * Determine if the inherits options should be shown.
   * Will also generate the inherits options.
   *
   * @returns true if user is inherits options should be shown, false otherwise
   */
  showInherits() {
    const result =
      !this.data.node.isDefaultNode() &&
      this.key.value === "inherits" &&
      ((!this.data.editMode && this.data.node.getLevel() === 1) ||
        (this.data.editMode && this.data.node.getLevel() === 2));

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
   *
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
    const hasCylic = (child: TreeNode) => {
      let inherited = child;
      while (inherited) {
        const inheritedEnv = _.find(
          inherited.children,
          c => c.key === "inherits"
        );
        if (!inheritedEnv) {
          break;
        }
        if (inheritedEnv.value === thisEnv) {
          return true;
        }
        inherited = _.find(envsRoot.children, { key: inheritedEnv.value });
      }
    };
    return envsRoot.children
      .filter(child => child.key !== thisEnv && !hasCylic(child))
      .map(child => child.key);
  }

  /**
   * Get bread crumb to display.
   *
   * @returns bread crumb
   */
  getBreadCrumb() {
    const node: TreeNode = this.data.node;
    if (this.data.editMode) {
      return `${node.parent ? node.parent.getPathsString() + "." : ""}${
        this.key.value
      }`;
    }
    return `${node.getPathsString()}${
      this.key.value ? "." + this.key.value : ""
    }`;
  }

  /*
   * Set value type based on the selected key
   * @param key the selected key
   */
  setValueTypeOption(key: string) {
    this.valueType.setValue(_.find(this.data.keyOptions, { key })["type"]);
  }

  /**
   * Checks to copy property from default tree.
   *
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
   *
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
   *
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
    this.anchor.setValue(_.trim(this.anchor.value));

    if (this.autoTrim) {
      if (this.valueType.value === PROPERTY_VALUE_TYPES.STRING) {
        this.value.setValue(_.trim(this.value.value));
      }
    }

    // check form validity
    const formValid =
      (this.key.disabled ? true : this.key.valid) &&
      (this.valueType.disabled ? true : this.valueType.valid) &&
      (!TreeNode.isLeafType(this.valueType.value) || this.value.disabled
        ? true
        : this.value.valid) &&
      (!this.showAnchor() ? true : this.anchor.valid);

    if (!formValid) {
      return;
    }

    // Validate number is in range
    if (this.valueType.value === PROPERTY_VALUE_TYPES.NUMBER) {
      const num = this.value.value;
      if (
        (_.isInteger(num) && !_.isSafeInteger(num)) ||
        (num >= Number.MAX_SAFE_INTEGER || num <= Number.MIN_SAFE_INTEGER)
      ) {
        this.value.setErrors({ range: true });
        return;
      }
    }

    // Validate key is unique
    if (
      !this.data.editMode ||
      this.data.node.isDefaultNode() ||
      this.isDefineEnv()
    ) {
      const existingKeys = [];
      if (!this.data.editMode) {
        const parent = this.data.node;
        _.each(parent.children, child => {
          existingKeys.push(child.key);
        });
      } else if (this.key.value !== this.data.node.key) {
        const parent = this.data.node.parent;
        _.each(parent.children, child => {
          if (child !== this.data.node) {
            existingKeys.push(child.key);
          }
        });
      }
      if (existingKeys.indexOf(this.key.value) > -1) {
        this.store.dispatch(
          new Alert({
            message: `Property key '${this.key.value}' already exists`,
            alertType: "error"
          })
        );
        return;
      }
    }

    // Validate anchor name is unique
    if (this.anchor.value) {
      const existingAnchors = [];
      if (!this.data.editMode || this.anchor.value !== this.data.node.anchor) {
        existingAnchors.push(...this.data.defaultTree.getAnchors());
      }
      if (existingAnchors.indexOf(this.anchor.value) > -1) {
        this.store.dispatch(
          new Alert({
            message: `Anchor name '${this.anchor.value}' already exists`,
            alertType: "error"
          })
        );
        return;
      }
    }

    if (
      this.data.editMode &&
      this.valueType.value !== this.data.node.valueType
    ) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          confirmationText:
            "You have changed the value type, the corresponding property will be removed from all environments. Do you still want to make the change?" // eslint-disable-line
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
    let node: TreeNode;

    if (!this.duplicateDefault && !this.duplicateFirstSibling) {
      node = new TreeNode(this.key.value, this.valueType.value);

      if (node.isLeaf()) {
        if (node.valueType === PROPERTY_VALUE_TYPES.BOOLEAN) {
          node.value = this.value.value === "true" || this.value.value === true;
        } else if (node.valueType === PROPERTY_VALUE_TYPES.NUMBER) {
          node.value = this.numberInput.nativeElement.value;
          if (
            node.value &&
            node.value.indexOf(".") < 0 &&
            node.value.indexOf("e") < 0
          ) {
            node.value = parseInt(node.value, 10);
          }
        } else {
          node.value = this.value.value;
        }
      }

      if (this.comment.value) {
        node.comment = this.comment.value.split("\n");
      }
    } else if (this.duplicateDefault) {
      // Clone default node
      let defaultNode: TreeNode;
      if (this.alias.value) {
        // Use alias node as default node
        defaultNode = this.data.defaultTree.findAnchorNode(this.alias.value);
      } else {
        defaultNode = this.getDefaultNodeToDuplicate();
      }

      if (this.valueType.value === PROPERTY_VALUE_TYPES.OBJECT_ARRAY) {
        node = new TreeNode(this.key.value, this.valueType.value);
        node.comment = _.cloneDeep(defaultNode.comment);
        _.each(defaultNode.children, c => {
          let cc;
          if (c.anchor) {
            cc = new TreeNode(c.key, c.valueType);
            cc.comment = _.cloneDeep(c.comment);
            cc.aliases = [c.anchor];
          } else {
            cc = this.cloneWithoutParent(c);
          }
          node.addChild(cc);
        });
      } else {
        node = this.cloneWithoutParent(defaultNode);
        node.key = this.key.value;
      }
    } else {
      // Clone first sibling
      const firstSibling = this.data.editMode
        ? this.data.node.parent.children[0]
        : this.data.node.children[0];
      node = this.cloneWithoutParent(firstSibling);
      node.key = this.key.value;
    }

    if (this.alias.value) {
      node.aliases = [this.alias.value];
    }
    if (this.anchor.value) {
      node.anchor = this.anchor.value;
    }

    this.saveProperty.emit(node);
  }

  /**
   * Get default node to duplicate.
   *
   * @return default node to duplicate
   */
  private getDefaultNodeToDuplicate() {
    // Build key hierarchy
    const keyHierarchy = [];
    let node = this.data.node;
    while (node && node.getLevel() > 1) {
      if (node.isObjectInArray()) {
        // object in array, use first child
        keyHierarchy.unshift("[0]");
      } else {
        keyHierarchy.unshift(node.key);
      }
      node = node.parent;
    }

    const keyValue = this.key.value;
    if (!this.data.editMode && this.data.node.getLevel() >= 1) {
      if (this.isNonFirstObjectInArray()) {
        keyHierarchy.push("[0]");
      } else {
        keyHierarchy.push(keyValue);
      }
    }

    // Find the respective defalut node
    let defaultNode = this.data.defaultTree;
    for (const hier of keyHierarchy) {
      defaultNode = _.find(
        defaultNode.children,
        child => child.key === hier
      );
    }
    return defaultNode;
  }

  /**
   * Check whether can duplicate default.
   *
   * @return true if can duplicate default, false otherwise
   */
  canDuplicateDefault() {
    return (
      !this.data.node.isDefaultNode() &&
      this.key.value !== "inherits" &&
      (!this.data.editMode || this.data.node.getLevel() > 0) &&
      !!this.getDefaultNodeToDuplicate()
    );
  }

  /**
   * Clone tree node without parent relationship.
   *
   * @param node the node to clone
   * @return cloned node
   */
  private cloneWithoutParent(node: TreeNode) {
    const parent = node.parent;
    node.parent = undefined;
    const result = _.cloneDeepWith(node, (_value, key) => {
      if (key === "anchor") {
        // Don't clone anchor since anchor name must be unique
        return null;
      }
    });
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
