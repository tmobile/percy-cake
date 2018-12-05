import * as _ from 'lodash';

import { PROPERTY_VALUE_TYPES } from 'config';

/**
 * Json node data with nested structure. Each node has a key and a value or a list of children
 */
export class TreeNode {
  children: TreeNode[] = undefined;
  parent: TreeNode = undefined;

  constructor(public key: string, public valueType: string = PROPERTY_VALUE_TYPES.OBJECT, public value?: any, public comment?: string[]) {
    if (!this.isLeaf()) {
      this.children = [];
    }
  }

  static isLeafType(type) {
    return type === PROPERTY_VALUE_TYPES.STRING
      || type === PROPERTY_VALUE_TYPES.BOOLEAN
      || type === PROPERTY_VALUE_TYPES.NUMBER;
  }

  addChild(child: TreeNode) {
    this.children = _.defaultTo(this.children, []);
    this.children.push(child);
    child.parent = this;
  }

  isLeaf() {
    return TreeNode.isLeafType(this.valueType);
  }

  isArray() {
    return this.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY
      || this.valueType === PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY
      || this.valueType === PROPERTY_VALUE_TYPES.NUMBER_ARRAY
      || this.valueType === 'array';
  }

  getArrayItemType() {
    switch (this.valueType) {
      case PROPERTY_VALUE_TYPES.STRING_ARRAY:
        return PROPERTY_VALUE_TYPES.STRING;
      case PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY:
        return PROPERTY_VALUE_TYPES.BOOLEAN;
      case PROPERTY_VALUE_TYPES.NUMBER_ARRAY:
        return PROPERTY_VALUE_TYPES.NUMBER;
    }
  }

  getCommentStr() {
    return this.comment && this.comment.length ? this.comment.join('\n') : undefined;
  }

  getLevel() {
    let level = 0;
    let parentNode = this.parent;
    while (parentNode) {
      level++;
      parentNode = parentNode.parent;
    }
    return level;
  }

  getPaths() {
    const paths = [this.key];
    let parentNode = this.parent;
    while (parentNode) {
      paths.unshift(parentNode.key);
      parentNode = parentNode.parent;
    }
    return paths;
  }

  getPathsWithoutRoot() {
    return this.getPaths().slice(1);
  }

  getPathsString() {
    return this.getPaths().join('.');
  }

  findChild(paths: string[]) {
    return _.reduce(paths, (node, path) => {
      if (!node) {
        return null;
      }
      return _.find(node.children, (child) => child.key === path);
    }, this);
  }

  isDefaultNode() {
    return this.getTopParent().key === 'default';
  }

  getTopParent() {
    let parentNode = this.parent;
    if (!parentNode) {
      return this;
    }
    while (parentNode && parentNode.parent) {
      parentNode = parentNode.parent;
    }
    return parentNode;
  }
}
