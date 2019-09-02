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
  SimpleChanges,
  ViewChild,
  ChangeDetectionStrategy
} from "@angular/core";
import { FlatTreeControl } from "@angular/cdk/tree";
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import { MatDialog } from "@angular/material";
import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { Observable } from "rxjs";
import { select, Store } from "@ngrx/store";
import * as _ from "lodash";

import { PROPERTY_VALUE_TYPES } from "config";
import { User } from "models/auth";
import { Configuration, EnvsVariablesConfig } from "models/config-file";
import { TreeNode } from "models/tree-node";
import { ConfigProperty } from "models/config-property";

import * as appStore from "store";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { YamlService } from "services/yaml.service";


/**
 *  Tree with nested nodes
 */
@Component({
  selector: "app-nested-config-view",
  templateUrl: "./nested-config-view.component.html",
  styleUrls: ["./nested-config-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
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

  @ViewChild("defaultViewport") defaultViewport: CdkVirtualScrollViewport;
  @ViewChild("envViewport") envViewport: CdkVirtualScrollViewport;

  propertyValueTypes = PROPERTY_VALUE_TYPES;

  currentUser: Observable<User> = this.store.pipe(
    select(appStore.getCurrentUser)
  );

  treeFlattener: MatTreeFlattener<TreeNode, TreeNode>;

  defaultTreeControl: FlatTreeControl<TreeNode>;
  defaultDataSource: MatTreeFlatDataSource<TreeNode, TreeNode>;

  envTreeControl: FlatTreeControl<TreeNode>;
  envDataSource: MatTreeFlatDataSource<TreeNode, TreeNode>;

  envsVariablesConfig: EnvsVariablesConfig;

  /**
   * initializes the component
   * @param dialog the material dialog instance
   * @param yamlService the yaml service
   */
  constructor(
    private store: Store<appStore.AppState>,
    private dialog: MatDialog,
    private yamlService: YamlService
  ) {
    const _getChildren = (node: TreeNode) => node.children;
    const _transformer = (node: TreeNode): TreeNode => node;

    this.treeFlattener = new MatTreeFlattener(
      _transformer, node => node.getLevel(), node => !node.isLeaf(), _getChildren
    );

    this.defaultTreeControl = new FlatTreeControl<TreeNode>(
      node => node.getLevel(), node => !node.isLeaf()
    );
    this.defaultDataSource = new MatTreeFlatDataSource(this.defaultTreeControl, this.treeFlattener);

    this.envTreeControl = new FlatTreeControl<TreeNode>(
      node => node.getLevel(), node => !node.isLeaf()
    );
    this.envDataSource = new MatTreeFlatDataSource(this.envTreeControl, this.treeFlattener);
  }

  /**
   * handle component changes
   * @param changes the changes
   */
  ngOnChanges(changes: SimpleChanges) {
    const configurationChanged = changes["configuration"];
    if (configurationChanged) {
      this.envsVariablesConfig = this.yamlService.getEnvsVariablesConfig(this.configuration);

      const defaultTree = this.configuration.default;
      this.defaultDataSource.data = [defaultTree];

      const environmentsTree = this.configuration.environments;
      this.envDataSource.data = [environmentsTree];

      this.defaultTreeControl.expandAll();
      this.envTreeControl.expandAll();
    }
  }

  toggle(treeControl, node, toggleAll?: boolean, expand?: boolean) {
    const expanded = treeControl.isExpanded(node);
    if (expanded && !expand) {
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

      const existingKeys = _.map(
        this.configuration.environments.children,
        c => c.key
      );
      keyOptions = _.filter(
        keyOptions,
        option => !_.includes(existingKeys, option.key)
      );
    } else {
      if (node.isArray()) {
        keyOptions.push({
          key: `[${node.children.length}]`,
          type: node.getArrayItemType()
        });
        return keyOptions;
      }

      const existingKeys = [];
      _.each(node.children, child => {
        existingKeys.push(child.key);
      });

      if (node.getLevel() === 1 && !_.includes(existingKeys, "inherits")) {
        keyOptions.push({ key: "inherits", type: "string" });
      }

      // Find the respective defalut node
      let defaultNode = this.defaultDataSource.data[0];

      if (node.aliases && node.aliases.length) {
        // Use alias node as default node
        defaultNode = defaultNode.findAnchorNode(node.aliases[0]);
      } else {
        // Build key hierarchy
        const keyHierarchy: string[] = [];
        let parentNode = node;
        while (parentNode && parentNode.getLevel() > 1) {
          if (parentNode.isObjectInArray()) {
            // object in array, use first child
            keyHierarchy.unshift("[0]");
          } else {
            keyHierarchy.unshift(parentNode.key);
          }
          parentNode = parentNode.parent;
        }

        for (let i = 0; i < keyHierarchy.length; i++) {
          defaultNode = _.find(defaultNode.children, { key: keyHierarchy[i] });
        }
      }

      if (defaultNode) {
        const childNodes = defaultNode.children.filter(
          child => !_.includes(existingKeys, child.key)
        );
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
      defaultTree: this.defaultDataSource.data[0]
    };
    this.addEditProperty.emit(this.currentConfigProperty);
  }

  /**
   * Refresh the tree
   */
  private refreshTree() {
    this.envsVariablesConfig = this.yamlService.getEnvsVariablesConfig(this.configuration);

    let _data = this.defaultDataSource.data;
    this.defaultDataSource.data = _data;

    _data = this.envDataSource.data;
    this.envDataSource.data = _data;

    this.configurationChange.emit(this.configuration);
  }

  /**
   * When a property name changes, rename any referenced variable.
   * @param node the TreeNode
   * @param oldName old name of the property
   * @param newName new name of the property
   */
  private renameReference(node: TreeNode, oldName: string, newName: string) {
    if (node.isLeaf()) {
      if (node.valueType !== PROPERTY_VALUE_TYPES.STRING) {
        return;
      }
      const regExp = new RegExp(
        this.yamlService.escapeRegExp(
          this.yamlService.constructVariable(oldName)
        ),
        "g"
      );
      let regExpResult;
      let retVal: string = node.value;
      while ((regExpResult = regExp.exec(_.defaultTo(node.value, "")))) {
        const fullMatch = regExpResult[0];
        retVal = retVal.replace(
          fullMatch,
          this.yamlService.constructVariable(newName)
        );
      }
      node.value = retVal;
    } else {
      _.each(node.children, child =>
        this.renameReference(child, oldName, newName)
      );
    }
  }

  /**
   * When anchor name changes, rename any referenced alias.
   * @param node the TreeNode
   * @param oldName old name of anchor
   * @param newName new name of anchor
   */
  private renameAlias(node: TreeNode, oldName: string, newName: string) {
    if (node.aliases && node.aliases.indexOf(oldName) > -1) {
      node.aliases = _.filter(node.aliases, alias => alias !== oldName);
      node.aliases.push(newName);
    }
    _.each(node.children, child => this.renameAlias(child, oldName, newName));
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
            envNode.parent.removeChildren([node.key]);
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
          this.renameReference(
            this.defaultDataSource.data[0],
            currentNode.key,
            node.key
          );
          this.renameReference(
            this.envDataSource.data[0],
            currentNode.key,
            node.key
          );
        }
      } else {
        // for environments tree, value types can not be changed
        node.valueType = currentNode.valueType;
      }

      if (
        currentNode.anchor &&
        node.anchor &&
        currentNode.anchor !== node.anchor
      ) {
        this.renameAlias(
          this.envDataSource.data[0],
          currentNode.anchor,
          node.anchor
        );
      }

      currentNode.key = node.key;
      currentNode.value = node.value;
      currentNode.valueType = node.valueType;
      currentNode.anchor = node.anchor;
      currentNode.aliases = node.aliases;
      currentNode.comment = node.comment;

      if (node.isLeaf()) {
        currentNode.children = undefined;
      } else {
        currentNode.children =
          node.children && node.children.length
            ? node.children
            : _.defaultTo(currentNode.children, []);
        _.each(currentNode.children, child => {
          child.parent = currentNode;
        });
      }
    } else {
      node.parent = currentNode;

      currentNode.children = _.defaultTo(currentNode.children, []);
      currentNode.children.push(node);

      // expand newly added nodes by default
      if (this.currentConfigProperty.node.isDefaultNode()) {
        this.defaultTreeControl.expand(node);
      } else {
        this.envTreeControl.expand(node);
      }
    }
  }

  /**
   * Saves the node
   * @param node the added/edited node
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
    this.showDetail(
      this.currentConfigProperty.editMode
        ? this.currentConfigProperty.node
        : node
    );
  }

  openMenu(event, menuTrigger) {
    event.preventDefault();
    menuTrigger.style.left = event.layerX + "px";
    menuTrigger.style.top =
      event.layerY + menuTrigger.offsetParent.scrollTop + "px";
    menuTrigger.click();
  }

  buttonOpenMenu(event, menuButton) {
    event.preventDefault();
    event.stopPropagation();
    menuButton.click();
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
    const isEnvironmentNode = !node.isDefaultNode() && node.getLevel() === 1;
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationText: `Are you sure you want to delete this ${
          isEnvironmentNode ? "environment" : "property"
        }?`
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
    parent.removeChildren([node.key]);

    if (!node.isDefaultNode() && node.getLevel() === 1) {
      // Delete inherit if any
      _.each(parent.children, child => {
        const inherits = child.findChild(["inherits"]);
        if (inherits && inherits.value === node.key) {
          child.removeChildren(["inherits"]);
        }
      });
    }

    if (node.anchor) {
      const removeAlias = (envNode: TreeNode) => {
        const needToRemove = [];

        _.each(envNode.children, envChild => {
          if (envChild.aliases && envChild.aliases.indexOf(node.anchor) > -1) {
            needToRemove.push(envChild.key);
          } else {
            removeAlias(envChild);
          }
        });

        envNode.removeChildren(needToRemove);
      };

      removeAlias(this.envDataSource.data[0]);
    }

    // if deleted node is from default tree, delete respective properties from environments tree
    if (!parent.isArray() && parent.isDefaultNode()) {
      this.alignEnvironmentProperties(node, envNode => {
        envNode.parent.removeChildren([node.key]);
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
   * scroll to a reference node, in a particular viewport (default or env)
   * @param node  the reference node to scroll to
   */
  scrollToReferenceNode(event, node: TreeNode) {
    event.stopPropagation();

    const paths = node.getPaths();
    const env = paths[0] === "default" ? "default" : paths[1];

    const dataSource = env === "default" ? this.defaultDataSource : this.envDataSource;
    const viewport = env === "default" ? this.defaultViewport : this.envViewport;

    const nodeIndex = _.findIndex(dataSource._flattenedData.value, flatNode =>
      flatNode.parent && flatNode.parent.key === env
      && flatNode.key === node.key && flatNode.getLevel() === node.getLevel()
    );

    viewport.scrollToIndex(nodeIndex);
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
  private alignEnvironmentProperties(
    node: TreeNode,
    action: (envNode: TreeNode) => void
  ) {
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
