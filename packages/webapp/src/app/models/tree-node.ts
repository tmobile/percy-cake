/** ========================================================================
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

import * as _ from "lodash";

import { PROPERTY_VALUE_TYPES } from "config";

/**
 * Tree node data with nested structure. Each node has a key and value type, and depends on value type
 * (simple string/boolean/number value or object/array), it has a value or a list of children.
 */
export class TreeNode {
  children: TreeNode[] = undefined;
  parent: TreeNode = undefined;

  anchor: string = null;
  aliases: string[] = null;

  /**
   * Creates a new tree node.
   * @param key the key of node
   * @param valueType the type of node, defaults to be 'object'
   * @param value the value of node
   * @param comment the comment of node
   */
  constructor(
    public key: string,
    public valueType: string = PROPERTY_VALUE_TYPES.OBJECT,
    public value?: any,
    public comment?: string[]
  ) {
    if (!this.isLeaf()) {
      this.children = [];
    }
  }

  /**
   * Check if the given type represetns a leaf type.
   * @param type the type to check
   * @returns true if given type is string/boolean/number, false otherwise
   */
  static isLeafType(type: string) {
    return (
      type === PROPERTY_VALUE_TYPES.STRING ||
      type === PROPERTY_VALUE_TYPES.BOOLEAN ||
      type === PROPERTY_VALUE_TYPES.NUMBER
    );
  }

  /**
   * Get anchor names of this node and its decendants.
   * @returns array of anchor names
   */
  getAnchors() {
    const result: string[] = [];
    if (this.anchor) {
      result.push(this.anchor);
    }
    if (this.children) {
      this.children.forEach(child => {
        result.push(...child.getAnchors());
      });
    }
    return result;
  }

  /**
   * Find node of given anchor name.
   * @param anchor The anchor name
   * @returns found node
   */
  findAnchorNode(anchor: string): TreeNode {
    if (this.anchor === anchor) {
      return this;
    }

    if (this.children) {
      for (const child of this.children) {
        const found = child.findAnchorNode(anchor);
        if (found) {
          return found;
        }
      }
    }
  }

  /**
   * Add child.
   * @param child the child to add
   */
  addChild(child: TreeNode) {
    this.children = _.defaultTo(this.children, []);
    this.children.push(child);
    child.parent = this;
  }

  /**
   * Check if this node represetns a leaf node.
   * @returns true if this node's type is string/boolean/number, false otherwise
   */
  isLeaf() {
    return TreeNode.isLeafType(this.valueType);
  }

  /**
   * Check if this node represetns an object item in array.
   * @returns true if this represetns an object item in array, false otherwise
   */
  isObjectInArray() {
    return (
      this.valueType === PROPERTY_VALUE_TYPES.OBJECT &&
      this.parent &&
      this.parent.isArray()
    );
  }

  /**
   * Check if this node represetns an array node.
   * @returns true if this node's type is string[]/boolean[]/number[]/object[]/array, false otherwise
   */
  isArray() {
    return (
      this.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY ||
      this.valueType === PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY ||
      this.valueType === PROPERTY_VALUE_TYPES.NUMBER_ARRAY ||
      this.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY ||
      this.valueType === "array"
    );
  }

  /**
   * Get array item type.
   * @returns array item type
   */
  getArrayItemType() {
    switch (this.valueType) {
      case PROPERTY_VALUE_TYPES.STRING_ARRAY:
        return PROPERTY_VALUE_TYPES.STRING;
      case PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY:
        return PROPERTY_VALUE_TYPES.BOOLEAN;
      case PROPERTY_VALUE_TYPES.NUMBER_ARRAY:
        return PROPERTY_VALUE_TYPES.NUMBER;
      case PROPERTY_VALUE_TYPES.OBJECT_ARRAY:
        return PROPERTY_VALUE_TYPES.OBJECT;
    }
  }

  /**
   * Get string representation of comments array, and truncate it to 300 characters if truncated is true
   * @param truncated  optional parameter which if true the comment string should be truncated
   * @returns comment string
   */
  getCommentStr(truncated?: boolean) {
    if (this.comment && this.comment.length) {
      const commentString = this.comment.join("\n");
      return truncated && commentString.length > 300
        ? commentString.substring(0, 300) + " ..."
        : commentString;
    }
    return undefined;
  }

  /**
   * Get level of this node (root node has level 0).
   * @returns level of this node
   */
  getLevel() {
    let level = 0;
    let parentNode = this.parent;
    while (parentNode) {
      level++;
      parentNode = parentNode.parent;
    }
    return level;
  }

  /**
   * Get paths of this node.
   * @returns array of paths
   */
  getPaths() {
    const paths = [this.key];
    let parentNode = this.parent;
    while (parentNode) {
      paths.unshift(parentNode.key);
      parentNode = parentNode.parent;
    }
    return paths;
  }

  /**
   * Get paths of this node without the root key.
   * @returns array of paths
   */
  getPathsWithoutRoot() {
    return this.getPaths().slice(1);
  }

  /**
   * Get string repsentation of paths of this node.
   * @returns string repsentation of paths
   */
  getPathsString() {
    return this.getPaths().join(".");
  }

  /**
   * Find child based on given paths.
   * @param paths array of paths
   * @returns child found or null
   */
  findChild(paths: string[]) {
    return _.reduce(
      paths,
      (node, path) => {
        if (!node) {
          return null;
        }
        return _.find(node.children, child => child.key === path);
      },
      this
    );
  }

  /**
   * Remove children of given keys.
   * @param keys The keys of children to remove.
   */
  removeChildren(keys: string[]) {
    if (keys && keys.length && this.children && this.children.length) {
      _.remove(this.children, item => keys.indexOf(item.key) > -1);
      if (this.isArray()) {
        this.children.forEach((element, idx) => {
          element.key = `[${idx}]`;
        });
      }
    }
  }

  /**
   * Check if this node is in 'default' tree.
   * @returns true if this node is in 'default' tree, false otherwise
   */
  isDefaultNode() {
    return this.getTopParent().key === "default";
  }

  /**
   * Get top parent node, aka the root.
   * @returns top root
   */
  getTopParent() {
    let top: TreeNode = this;
    while (top && top.parent) {
      top = top.parent;
    }
    return top;
  }
}

/**
 * Flat tree node to render nodes as a flattened tree
 */
export interface FlatTreeNode extends TreeNode {
  level: number;
  expandable: boolean;
}
