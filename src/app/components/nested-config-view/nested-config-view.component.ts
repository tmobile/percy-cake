import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { MatDialog } from '@angular/material';
import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from 'config';
import { Configuration } from 'models/config-file';
import { TreeNode } from 'models/tree-node';
import { ConfigProperty } from 'models/config-property';

import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

/**
 *  Tree with nested nodes
 */
@Component({
  selector: 'app-nested-config-view',
  templateUrl: './nested-config-view.component.html',
  styleUrls: ['./nested-config-view.component.scss']
})
export class NestedConfigViewComponent implements OnChanges {
  currentConfigProperty: ConfigProperty;
  @Input() envFileMode: boolean; // Mode to create/edit environments.yaml file
  @Input() configuration: Configuration;
  @Input() environments: Array<string>;

  @Output() configurationChange = new EventEmitter<any>();
  @Output() selectedNode = new EventEmitter<TreeNode>();
  @Output() addEditProperty = new EventEmitter<ConfigProperty>();
  @Output() cancelAddEditPropertyChange = new EventEmitter<any>();
  @Output() viewCompiledYAMLEvent = new EventEmitter<string>();

  defaultTreeControl: NestedTreeControl<TreeNode>;
  defaultDataSource: MatTreeNestedDataSource<TreeNode>;

  envTreeControl: NestedTreeControl<TreeNode>;
  envDataSource: MatTreeNestedDataSource<TreeNode>;

  firstInit = true;

  /**
   * initializes the component
   * @param dialog the material dialog instance
   * @param store the application store
   */
  constructor(private dialog: MatDialog) {
    const _getChildren = (node: TreeNode) => node.children;
    this.defaultTreeControl = new NestedTreeControl<TreeNode>(_getChildren);
    this.defaultDataSource = new MatTreeNestedDataSource();
    this.envTreeControl = new NestedTreeControl<TreeNode>(_getChildren);
    this.envDataSource = new MatTreeNestedDataSource();
  }

  /**
   * handle component initialization
   */
  ngOnChanges() {
    const defaultTree = this.configuration.default;

    if (!this.defaultDataSource.data
      || !this.defaultDataSource.data.length
      || !_.isEqual(this.defaultDataSource.data[0], defaultTree)) {
      this.defaultDataSource.data = [defaultTree];
    }

    const environmentsTree = this.configuration.environments;

    if (!this.envDataSource.data
      || !this.envDataSource.data.length
      || !_.isEqual(this.envDataSource.data[0], environmentsTree)) {
      this.envDataSource.data = [environmentsTree];
    }

    if (this.firstInit) {
      this.firstInit = false;
      this.toggle(this.defaultTreeControl, this.defaultDataSource.data[0], true);
      this.toggle(this.envTreeControl, this.envDataSource.data[0], true);
    }
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

    if (node.isDefaultNode()) {
      // Only cares env nodes
      return [];
    }

    if (editMode) {
      // Only cares add property mode
      return [{ key: node.key, type: node.valueType }];
    }

    let keyOptions = [];

    if (node.getLevel() === 0) {
      if (this.envFileMode) {
        // In env file mode, you can define property names under environments (for new environment objects)
        return keyOptions;
      }

      keyOptions = _.map(this.environments, environment => {
        return { key: environment, type: PROPERTY_VALUE_TYPES.OBJECT };
      });

      const existingKeys = _.map(this.configuration.environments.children, c => c.key);
      keyOptions = _.filter(keyOptions, option => !_.includes(existingKeys, option.key));
    } else {

      if (node.isArray()) {
        keyOptions.push({ key: `[${node.children.length}]`, type: node.getArrayItemType() });
        return keyOptions;
      }

      const existingKeys = [];
      _.each(node.children, child => {
        existingKeys.push(child.key);
      });

      if (node.getLevel() === 1 && !_.includes(existingKeys, 'inherits')) {
        keyOptions.push({ key: 'inherits', type: 'string' });
      }

      // Build key hierarchy
      const keyHierarchy: string[] = [];
      let parentNode = node;
      while (parentNode && parentNode.getLevel() > 1) {
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
          keyOptions.push({ key: childNode.key, type: childNode.valueType });
        });
      }
    }
    return keyOptions;
  }

  /*
   * add new property
   */
  openAddPropertyDialog(node: TreeNode) {
    this.currentConfigProperty = {
      editMode: false,
      envFileMode: this.envFileMode,
      keyOptions: this.getKeyOptions(node, false),
      node,
      defaultTree: this.defaultDataSource.data[0]
    };
    this.addEditProperty.emit(this.currentConfigProperty);
  }

  /*
   * edit existing property
   */
  openEditPropertyDialog(node: TreeNode) {
    // construct the property object
    this.currentConfigProperty = {
      editMode: true,
      envFileMode: this.envFileMode,
      keyOptions: this.getKeyOptions(node, true),
      node,
      defaultTree: this.defaultDataSource.data[0],
    };
    this.addEditProperty.emit(this.currentConfigProperty);
  }

  /**
   * Refresh the tree
   */
  private refreshTree() {
    let _data = this.defaultDataSource.data;
    this.defaultDataSource.data = null;
    this.defaultDataSource.data = _data;

    _data = this.envDataSource.data;
    this.envDataSource.data = null;
    this.envDataSource.data = _data;

    const newConfiguration = new Configuration(this.defaultDataSource.data[0], this.envDataSource.data[0]);
    this.configurationChange.emit(newConfiguration);
  }

  /**
   * Do save property
   * @param node the added/edited node
   */
  private doSaveAddEditProperty(node: TreeNode) {

    const currentNode = this.currentConfigProperty.node;

    if (this.currentConfigProperty.editMode) {
      if (currentNode.isDefaultNode()) {
        if (currentNode.valueType !== node.valueType) {
          // if value type changes, delete respective nodes from environments tree
          this.alignEnvironmentProperties(currentNode, envNode => {
            _.remove(envNode.parent.children, item => item.key === node.key);
          });
          if (currentNode.isArray()) {
            // array type changes
            currentNode.children = [];
          }
        } else if (currentNode.key !== node.key) {
          // if key changes, rename respective nodes from environments tree
          this.alignEnvironmentProperties(currentNode, envNode => {
            envNode.key = node.key;
          });
        }
      } else {
        // for environments tree, value types can not be changed
        node.valueType = currentNode.valueType;
      }

      currentNode.key = node.key;
      currentNode.value = node.value;
      currentNode.valueType = node.valueType;
      currentNode.comment = node.comment;

      if (node.isLeaf()) {
        currentNode.children = undefined;
      } else {
        currentNode.children = node.children && node.children.length ?
          node.children : _.defaultTo(currentNode.children, []);
        _.each(currentNode.children, child => {
          child.parent = currentNode;
        });
      }

    } else {
      node.parent = currentNode;

      currentNode.children = _.defaultTo(currentNode.children, []);
      currentNode.children.push(node);
    }
  }

  /**
   * saves the node
   * @param node the added/edited node
   * @return true if succesfully saved; false otherwise (like validation fails)
   */
  saveAddEditProperty(node: TreeNode) {

    this.doSaveAddEditProperty(node);

    if (!this.currentConfigProperty.editMode) {
      if (this.currentConfigProperty.node.isDefaultNode()) {
        this.defaultTreeControl.expand(this.currentConfigProperty.node);
      } else {
        this.envTreeControl.expand(this.currentConfigProperty.node);
      }
    }

    this.refreshTree();
    this.cancelAddEditProperty();
    return true;
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

        this.doDeleteProperty(node);
        this.refreshTree();
        this.cancelAddEditProperty();
      }
    });
  }

  /**
   * Do delete property
   * @param node the deleted node
   */
  private doDeleteProperty(node: TreeNode) {

    const parent = node.parent;
    _.remove(parent.children, item => item.key === node.key);
    if (parent.isArray()) {
      parent.children.forEach((element, idx) => {
        element.key = `[${idx}]`;
      });
    }

    // if deleted node is from default tree, delete respective properties from environments tree
    if (parent.isDefaultNode()) {
      this.alignEnvironmentProperties(node, envNode => {
        _.remove(envNode.parent.children, item => item.key === node.key);
      });
    }
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
   * align the corresponding nodes from other environments
   * @param node node which is modified/deleted
   * @param action the alignment action
   */
  private alignEnvironmentProperties(node: TreeNode, action: (envNode: TreeNode) => void) {
    const envsTree = this.envDataSource.data[0];

    const paths = node.getPathsWithoutRoot(); // Without the root 'default' part

    _.each(envsTree.children, envChild => {
      const found = envChild.findChild(paths);
      if (found) {
        action(found);
      }
    });
  }

}
