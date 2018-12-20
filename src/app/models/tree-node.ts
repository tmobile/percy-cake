import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from 'config';

/**
 * Tree node data with nested structure. Each node has a key and value type, and depends on value type
 * (simple string/boolean/number value or object/array), it has a value or a list of children.
 */
export class TreeNode {
  children: TreeNode[] = undefined;
  parent: TreeNode = undefined;

  /**
   * Creates a new tree node.
   * @param key the key of node
   * @param valueType the type of node, defaults to be 'object'
   * @param value the value of node
   * @param comment the comment of node
   */
  constructor(public key: string, public valueType: string = PROPERTY_VALUE_TYPES.OBJECT, public value?: any, public comment?: string[]) {
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
    return type === PROPERTY_VALUE_TYPES.STRING
      || type === PROPERTY_VALUE_TYPES.BOOLEAN
      || type === PROPERTY_VALUE_TYPES.NUMBER;
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
   * Check if this node represetns an array node.
   * @returns true if this node's type is string[]/boolean[]/number[]/object[]/array, false otherwise
   */
  isArray() {
    return this.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY
      || this.valueType === PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY
      || this.valueType === PROPERTY_VALUE_TYPES.NUMBER_ARRAY
      || this.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY
      || this.valueType === 'array';
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
   * Get string representation of comments array.
   * @returns comment string
   */
  getCommentStr() {
    return this.comment && this.comment.length ? this.comment.join('\n') : undefined;
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
    return this.getPaths().join('.');
  }

  /**
   * Find child based on given paths.
   * @param paths array of paths
   * @returns child found or null
   */
  findChild(paths: string[]) {
    return _.reduce(paths, (node, path) => {
      if (!node) {
        return null;
      }
      return _.find(node.children, (child) => child.key === path);
    }, this);
  }

  /**
   * Check if this node is in 'default' tree.
   * @returns true if this node is in 'default' tree, false otherwise
   */
  isDefaultNode() {
    return this.getTopParent().key === 'default';
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
