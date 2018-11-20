import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from '../../config/index';
import { TreeNode } from '../../models/tree-node';
import { MatDialog } from '@angular/material';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { Store } from '@ngrx/store';
import * as appStore from '../../store';
import { BehaviorSubject } from 'rxjs';
import { UtilService } from '../../services/util.service';
import { Configuration } from '../../models/config-file';

/**
 *  Tree with nested nodes
 */
@Component({
  selector: 'app-nested-config-view',
  templateUrl: './nested-config-view.component.html',
  styleUrls: ['./nested-config-view.component.scss']
})
export class NestedConfigViewComponent implements OnChanges {
  currentAddEditProperty: TreeNode;
  currentAddEditPropertyOptions: any;
  @Input() isEnvMode: boolean;
  @Input() configuration: any;
  @Input() environments: Array<string>;

  @Output() configurationChange = new EventEmitter<any>();
  @Output() selectedNode = new EventEmitter<TreeNode>();
  @Output() addEditProperty = new EventEmitter<any>();
  @Output() cancelAddEditPropertyChange = new EventEmitter<any>();
  @Output() viewCompiledYAMLEvent = new EventEmitter<string>();

  defaultTreeControl: NestedTreeControl<TreeNode>;
  defaultDataSource: MatTreeNestedDataSource<TreeNode>;

  envTreeControl: NestedTreeControl<TreeNode>;
  envDataSource: MatTreeNestedDataSource<TreeNode>;

  defaultCardHeight = new BehaviorSubject<number|string>(null);
  envCardHeight = new BehaviorSubject<number|string>(null);

  /**
   * initializes the component
   * @param dialog the material dialog instance
   * @param store the application store
   */
  constructor(private dialog: MatDialog, private store: Store<appStore.AppState>, private utilService: UtilService) {
    this.defaultTreeControl = new NestedTreeControl<TreeNode>(this._getChildren);
    this.defaultDataSource = new MatTreeNestedDataSource();
    this.envTreeControl = new NestedTreeControl<TreeNode>(this._getChildren);
    this.envDataSource = new MatTreeNestedDataSource();
  }

  /**
   * handle component initialization
   */
  ngOnChanges() {
    const defaultNode = this.utilService.buildConfigTree(this.configuration.default || {}, 0, 'default', null);

    if (!this.defaultDataSource.data || !this.defaultDataSource.data.length
      || !_.isEqual(this.defaultDataSource.data[0].jsonValue, defaultNode.jsonValue)) {
      this.defaultDataSource.data = [defaultNode];
    }

    const environmentsNode = this.utilService.buildConfigTree(this.configuration.environments || {}, 0, 'environments', null);
    if (!this.envDataSource.data || !this.envDataSource.data.length
      || !_.isEqual(this.envDataSource.data[0].jsonValue, environmentsNode.jsonValue)) {
      this.envDataSource.data = [environmentsNode];
    }
  }

  // get a node's children
  private _getChildren = (node: TreeNode) => node.children;

  changeDefaultCardHeight(height) {
    this.defaultCardHeight.next(height);
  }

  changeEnvCardHeight(height) {
    this.envCardHeight.next(height);
  }

  toggle(treeControl, node, toggleAll?: boolean) {
    const expanded = treeControl.isExpanded(node);
    if (expanded) {
      if (toggleAll) {
        treeControl.collapseDescendants(node);
      } else {
        treeControl.collapse(node);
      }
    } else {
      if (toggleAll) {
        treeControl.expandDescendants(node);
      } else {
        treeControl.expand(node);
      }
    }
  }

  /*
   * when condition in mat-nested-tree-node
   * which returns true if a node has children
   */
  hasNestedChild = (n: number, node: TreeNode) => !node.isLeaf();

  /**
   * prepare the dropdown options based node and mode
   */
  private getKeyOptions(node: TreeNode, editMode: boolean) {
    let keyOptions = [];

    if (node.isDefaultNode()) {
      // Only cares env nodes
      return keyOptions;
    }

    if (editMode) {
      // Only cares add property mode
      keyOptions.push({ key: node.key, type: node.valueType });
      return keyOptions;
    }

    if (node.level === 0) {
      keyOptions = _.map(this.environments, environment => {
        return { key: environment, type: PROPERTY_VALUE_TYPES.OBJECT };
      });

      const existingKeys = _.keys(this.configuration.environments);
      keyOptions = _.filter(keyOptions, option => !_.includes(existingKeys, option.key));
    } else {

      if (node.isArray()) {
        keyOptions.push({ key: `[${node.children.length}]`, type: node.getArrayItemType() });
        return keyOptions;
      }

      const existingKeys = [];
      if (node.children) {
        node.children.forEach(child => {
          existingKeys.push(child.key);
        });
      }

      if (node.level === 1 && !_.includes(existingKeys, 'inherits')) {
        keyOptions.push({ key: 'inherits', type: 'string' });
      }

      // Build key hierarchy
      const keyHierarchy = node.level > 1 ? [node.key] : [];
      let parentNode = node.parent;
      while (parentNode && parentNode.level > 1) {
        keyHierarchy.unshift(parentNode.key);
        parentNode = parentNode.parent;
      }

      // Find the respective defalut node
      let defaultNode = this.defaultDataSource.data[0];
      for (let i = 0; i < keyHierarchy.length; i++) {
        defaultNode = _.find(defaultNode.children, { key: keyHierarchy[i] });
      }

      if (defaultNode) {
        const childNodes = defaultNode.children.filter(child => !_.includes(existingKeys, child.key));
        childNodes.forEach(childNode => {
          keyOptions.push({key: childNode.key, type: childNode.valueType});
        });
      }
    }
    return keyOptions;
  }

  /*
   * add new property
   */
  openAddPropertyDialog(node: TreeNode) {
    this.currentAddEditProperty = node;
    this.currentAddEditPropertyOptions = {
      editMode: false,
      level: node.level,
      isDefaultNode: node.isDefaultNode(),
      keyOptions: this.getKeyOptions(node, false),
      node,
      defaultNode: this.defaultDataSource.data[0]
    };
    this.addEditProperty.emit(this.currentAddEditPropertyOptions);
  }

  /*
   * edit existing property
   */
  openEditPropertyDialog(node: TreeNode) {
    // construct the property object
    this.currentAddEditProperty = node;
    this.currentAddEditPropertyOptions = {
      editMode: true,
      level: node.level,
      isDefaultNode: node.isDefaultNode(),
      keyOptions: this.getKeyOptions(node, true),
      node,
      defaultNode: this.defaultDataSource.data[0],
      configProperty: node.toConfigProperty(),
    };
    this.addEditProperty.emit(this.currentAddEditPropertyOptions);
  }

  /**
   * Refresh the tree
   */
  refreshTree() {
    let _data = this.defaultDataSource.data;
    this.defaultDataSource.data = null;
    this.defaultDataSource.data = _data;

    _data = this.envDataSource.data;
    this.envDataSource.data = null;
    this.envDataSource.data = _data;

    const newConfig: Configuration = {default: this.defaultDataSource.data[0].jsonValue};
    if (!this.isEnvMode) {
      newConfig.environments = this.envDataSource.data[0].jsonValue;
    }

    this.configurationChange.emit(newConfig);
  }

  /**
   * saves the node
   * @param node the added/edited node
   */
  saveAddEditProperty(node: TreeNode) {
    if (this.currentAddEditPropertyOptions.editMode) {
      if (this.currentAddEditProperty.isDefaultNode()) {
        // for default tree, if key or value type changes, delete respective nodes from environments tree
        if (this.currentAddEditProperty.key !== node.key || this.currentAddEditProperty.valueType !== node.valueType) {
          this.deleteEnvironmentProperties(this.currentAddEditProperty);
        }

        // array type changes
        if (this.currentAddEditProperty.isArray() && this.currentAddEditProperty.valueType !== node.valueType) {
          this.currentAddEditProperty.children = [];
        }
      } else {
        // for environments tree, value types can not be changed
        node.valueType = this.currentAddEditProperty.valueType;
      }

      this.currentAddEditProperty.key = node.key;
      this.currentAddEditProperty.value = node.value;
      this.currentAddEditProperty.valueType = node.valueType;
      this.currentAddEditProperty.comment = node.comment;

      if (node.isLeaf()) {
        this.currentAddEditProperty.children = undefined;
      } else {
        this.currentAddEditProperty.children = node.children && node.children.length ?
          node.children : this.currentAddEditProperty.children || [];
      }

      this.updateJsonValue(this.currentAddEditProperty);
    } else {
      node.level = this.currentAddEditProperty.level + 1;
      node.parent = this.currentAddEditProperty;
      node.id = `${this.currentAddEditProperty.id}.${node.key}`;

      this.currentAddEditProperty.children = this.currentAddEditProperty.children || [];
      this.currentAddEditProperty.children.push(node);

      if (this.currentAddEditProperty.isDefaultNode()) {
        this.defaultTreeControl.expand(this.currentAddEditProperty);
      } else {
        this.envTreeControl.expand(this.currentAddEditProperty);
      }
      this.updateJsonValue(node);
    }

    this.refreshTree();
    this.cancelAddEditProperty();
  }

  openMenu(event, menuTrigger) {
    event.preventDefault();
    menuTrigger.style.left = event.layerX + 'px';
    menuTrigger.style.top = event.Y + 'px';
    menuTrigger.click();
  }

  buttonOpenMenu(event, menuButton) {
    event.preventDefault();
    event.stopPropagation();
    menuButton._elementRef.nativeElement.click();
  }

  /*
   * Do update TreeNode's json value
   */
  private doUpdateJsonValue(node: TreeNode) {
    const json = {};
    if (node.comment) {
      json['$comment'] = node.comment;
    }
    json['$type'] = node.valueType;
    if (node.isArray()) {
      json['$type'] = 'array';
    }
    if (node.children) {
      if (node.isArray()) {
        const arr = [];
        node.children.forEach(child => {
          this.doUpdateJsonValue(child);
          arr.push(child.jsonValue);
        });
        json['$value'] = arr;
      } else {
        node.children.forEach(child => {
          this.doUpdateJsonValue(child);
          json[child.key] = child.jsonValue;
        });
      }
    } else {
      json['$value'] = node.value;
    }

    node.jsonValue = json;
  }

  /**
   * updates the json value of node and its all parent
   * @param node the node to update
   */
  private updateJsonValue(node: TreeNode) {
    this.doUpdateJsonValue(!node.parent ? node : node.getTopParent());
  }

  /**
   * cancels the add/edit property action
   */
  cancelAddEditProperty() {
    this.cancelAddEditPropertyChange.emit();
  }

  /**
   * deletes the property from configuration
   * @param node node to delete
   */
  deleteProperty(node: TreeNode) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'Are you sure you want to delete this property?'
      }
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response) {
        this.cancelAddEditProperty();
        const parent = node.parent;
        _.remove(parent.children, item => item.key === node.key);
        if (parent.isArray()) {
          parent.children.forEach((element, idx) => {
            element.key = `[${idx}]`;
            element.id = `${parent.id}.${element.key}`;
          });
        }
        this.updateJsonValue(node);
        // if deleted node is from default tree, delete respective properties from environments tree
        if (node.isDefaultNode()) {
          this.deleteEnvironmentProperties(node);
        }
        this.refreshTree();
      }
    });
  }

  /**
   * shows the detail of node in right side
   * @param node node to show as selected
   */
  showDetail(node: TreeNode) {
    this.selectedNode.emit(node);
  }

  /**
   * view compiled YAML action handler
   * @param environment the environment to compile
   */
  viewCompiledYAML(environment: string) {
    this.viewCompiledYAMLEvent.emit(environment);
  }

  /**
   * deletes the corresponding nodes from other environments
   * @param node node which is deleted
   */
  private deleteEnvironmentProperties(node: TreeNode) {
    const envsNode = this.envDataSource.data[0];
    const descendants = this.envTreeControl.getDescendants(envsNode);
    let foundAny = false;

    if (envsNode && envsNode.children) {
      envsNode.children.forEach(env => {
        const path = node.id.replace('default', `environments.${env.key}`);
        const found = _.find(descendants, { id: path });
        if (found) {
          _.remove(found.parent.children, item => item.key === node.key);
          foundAny = true;
        }
      });
    }

    if (foundAny) {
      this.updateJsonValue(envsNode);
    }
  }
}
