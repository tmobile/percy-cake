import { ConfigProperty } from './config-property';
import { PROPERTY_VALUE_TYPES } from '../config';

/**
 * Json node data with nested structure. Each node has a key and a value or a list of children
 */
export class TreeNode {
    id: string;
    children: TreeNode[];
    parent: TreeNode;
    key: string;
    value: any;
    level: number;
    jsonValue: any;
    valueType: string;
    comment: string[];

    static isLeafType(type) {
      return type === PROPERTY_VALUE_TYPES.STRING
        || type === PROPERTY_VALUE_TYPES.BOOLEAN
        || type === PROPERTY_VALUE_TYPES.NUMBER;
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
        default:
          break;
      }
    }

    toConfigProperty(): ConfigProperty {
        const property = new ConfigProperty();
        property.key = this.key;
        property.value = this.value;
        property.valueType = this.valueType;
        property.comment = this.comment && this.comment.length ? this.comment.join('\n') : undefined;
        property.level = this.level;
        property.isDefaultNode = this.isDefaultNode();

        return property;
    }

    getBreadCrumb(key: string = this.key) {
      let breadCrumb = key;
      let parentNode = this.parent;
      while (parentNode) {
          breadCrumb = parentNode.key + ' / ' + breadCrumb;
          parentNode = parentNode.parent;
      }
      return breadCrumb;
    }

    isDefaultNode() {
        if (this.level === 0 && this.key === 'default') {
            return true;
        }
        if (this.level === 0 && this.key === 'environments') {
            return false;
        }
        const parentNode = this.getTopParent();
        return parentNode && parentNode.level === 0 && parentNode.key === 'default';
    }

    getTopParent() {
        let parentNode = this.parent;
        while (parentNode && parentNode.parent) {
            parentNode = parentNode.parent;
        }
        return parentNode;
    }
}
