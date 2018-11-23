import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import * as jsYaml from 'js-yaml';
import { ConfigProperty } from '../models/config-property';
import { TreeNode } from '../models/tree-node';
import { PROPERTY_VALUE_TYPES } from '../config';

/**
 * This service provides the utility methods
 */
@Injectable({ providedIn: 'root' })
export class UtilService {

  // mapping of type from JSON to YAML
  private typeMapReverse = {
    string: 'str',
    number: 'float',
    object: 'map',
    boolean: 'bool',
    array: 'seq',
  };

  /**
   * initializes the service
   */
  constructor() { }

  /**
   * saves the key, value to storage default persistence is false
   * @param key the key to store
   * @param value the value to store
   * @param persist the flag whether to persist in local storage or not
   */
  saveToStorage(key: string, value: any, persist: boolean = true): void {
    const jsonData = JSON.stringify(value);
    sessionStorage.setItem(key, jsonData);
    if (persist) {
      localStorage.setItem(key, jsonData);
    }
  }

  /**
   * gets the key, value from storage
   * @param key the key to get from store
   */
  getFromStorage(key: string): any {
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = localStorage.getItem(key);
    }
    return value !== 'undefined' ? JSON.parse(value) : null;
  }

  /**
   * removes the key, value from storage
   * @param key the key to remove store
   */
  removeFromStorage(key: string): void {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  /**
   * Render yaml comment.
   * @param comment The comment to render
   * @returns the comment rendered
   */
  renderYamlComment(comment: string) {
    if (!comment) {
      return '  #';
    }

    if (comment[0] === '#' && comment[1] === '#') {
      // For multiple consecutive '#', like: '###...'
      // return it as is
      return `  ${comment}`;
    }

    return `  # ${comment}`;
  }

  /**
   * Walk json tree, convert to yaml format.
   * @param jsonNode The json tree node
   * @param indent The indent spaces
   * @returns Yaml format string
   */
  walkJsonTree(jsonNode, indent: string = '') {

    let result = '';
    const isArray = _.isArray(jsonNode);

    _.each(jsonNode, (value, key) => {
      if (key === '$comment') {
        return;
      }

      if (key === '$type') {
        return;
      }

      if (key === '$value') {
        result = this.walkJsonTree(value, indent);
        return;
      }

      if (isArray) {
        result += indent + '-';
      } else {
        result += indent + key + ':';
      }

      if (value === null || value === undefined) {
        result += '\n';
        return;
      }

      // Extract comment
      const comment = value.$comment;
      const hasComment = _.isArray(comment) && comment.length > 0;

      let type = value.$type;
      // Extract value
      if (_.has(value, '$value')) {
        value = value.$value;
      }

      if (type === 'number' && _.isInteger(value)) {
        type = 'int';
      } else {
        type = this.typeMapReverse[type];
      }
      if (type) {
        if (!isArray || type !== 'map') {
          result += ' !!' + type;
        }
      }

      if (_.isObject(value)) {
        // Append inline comment and multiple lines comments
        if (hasComment) {
          result += this.renderYamlComment(comment[0]);

          for (let i = 1; i < comment.length; i++) {
            result += '\n' + indent + this.renderYamlComment(comment[i]);
          }
        }
        // Recursively walk the value node
        const nestResult = this.walkJsonTree(value, indent + '  ');
        result += isArray && !_.isArray(value) ? ' ' + _.trimStart(nestResult) : '\n' + nestResult;
      } else {
        // Append simple value and inline comment
        if (type === 'str') {
          value = value.replace('\\', '\\\\');
          value = value.replace('"', '\\"');
          result += ' "' + value + '"';
        } else {
          result += ' ' + value;
        }
        if (hasComment) {
          result += this.renderYamlComment(comment[0]);

          for (let i = 1; i < comment.length; i++) {
            result += '\n' + indent + this.renderYamlComment(comment[i]);
          }
        }
        result += '\n';
      }
    });

    return result;
  }

  /**
  * Convert json object to yaml format.
  * @param json The json object
  * @returns Yaml format string
  */
  convertJsonToYaml(json) {
    if (_.isEmpty(json)) {
      return _.isArray(json) ? '[]' : '{}';
    }

    let result = '';

    if (json.$comment) {
      // Add root comments
      _.each(json.$comment, (comment) => {
        if (/^(\s)*(#.*)/.test(comment) || _.isEmpty(comment)) {
          result += comment + '\n';
        } else {
          result += '# ' + comment + '\n';
        }
      });
    }

    result += this.walkJsonTree(json);

    try {
      // Validate against safe schema
      jsYaml.safeLoad(result, { strict: true });
    } catch (err) {
      console.error('Error while parsing configuration to yaml', err);
    }

    return result;
  }

  /**
   * converts the editing property detail to tree node
   * @param property the config property
   */
  convertToTreeNode(property: ConfigProperty): TreeNode {
    const node = new TreeNode();
    node.key = property.key;
    node.valueType = property.valueType;

    if (node.isLeaf()) {
      if (property.valueType === PROPERTY_VALUE_TYPES.BOOLEAN) {
        property.value = property.value === 'true' || property.value === true;
      } else if (property.valueType === PROPERTY_VALUE_TYPES.NUMBER) {
        property.value = _.toNumber(property.value);
      } else if (property.valueType === PROPERTY_VALUE_TYPES.STRING) {
        property.value = property.value;
      }
      node.value = property.value;
    } else {
      node.children = [];
    }

    if (property.comment) {
      node.comment = property.comment.split('\n');
    }

    return node;
  }

  /**
   * Build the config structure tree. The `obj` is the Json object, or a sub-tree of a Json object.
   * The return value is `TreeNode`.
   */
  buildConfigTree(obj: object, level: number, key: string, parentNode?: TreeNode): TreeNode {
    const node = new TreeNode();
    node.key = key;
    node.id = parentNode ? `${parentNode.id}.${key}` : key;
    node.value = obj['$value'];
    obj['$type'] = obj['$type'] || (node.value ? typeof node.value : 'object');
    node.valueType = obj['$type'];
    node.comment = obj['$comment'];
    node.parent = parentNode;
    node.level = level;
    node.jsonValue = obj;

    if (!node.isLeaf()) {
      node.children = [];

      if (node.isArray()) {
        let itemType;

        node.value = _.isArray(node.value) ? node.value : [];
        node.value.forEach((element, idx) => {
          const item = this.buildConfigTree(element, level + 1, `[${idx}]`, node);
          if (!item.isLeaf()) {
            console.warn(`Only support array of same simple type, but got: ${item}`);
            return;
          }
          if (!itemType) {
            itemType = item.valueType;
          } else if (itemType !== item.valueType) {
            console.warn(`Only support array of same simple type, ${itemType} detected, but got: ${item}`);
            return;
          }
          node.children.push(item);
        });

        itemType = itemType || PROPERTY_VALUE_TYPES.STRING;
        switch (itemType) {
          case PROPERTY_VALUE_TYPES.STRING:
            node.valueType = PROPERTY_VALUE_TYPES.STRING_ARRAY;
            break;
          case PROPERTY_VALUE_TYPES.BOOLEAN:
            node.valueType = PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY;
            break;
          case PROPERTY_VALUE_TYPES.NUMBER:
            node.valueType = PROPERTY_VALUE_TYPES.NUMBER_ARRAY;
            break;
          default:
            break;
        }
      } else {
        Object.keys(obj).forEach((nestKey) => {
          if (nestKey === '$comment' || nestKey === '$value' || nestKey === '$type') {
            return;
          }
          node.children.push(this.buildConfigTree(obj[nestKey], level + 1, nestKey, node));
        });
      }

      node.value = undefined;
    }

    return node;
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
  updateJsonValue(node: TreeNode) {
    this.doUpdateJsonValue(!node.parent ? node : node.getTopParent());
  }

  private escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  replace(target, options) {
    const regexPattern = `${this.escapeRegExp(options.prefix)}(.+?)${this.escapeRegExp(options.suffix)}`;
    const includeRegExp = new RegExp(regexPattern, 'g');
    const text = JSON.stringify(target);

    let retVal = text;
    let regExpResult;

    while (regExpResult = includeRegExp.exec(text)) {
      const fullMatch = regExpResult[0];
      const tokenName = regExpResult[1];
      let tokenValue = options.tokens[tokenName];

      if (tokenValue !== null && tokenValue !== undefined) {
        if (typeof tokenValue === 'string') {
          tokenValue = tokenValue.replace(/"/g, '\\"');
        }

        retVal = retVal.replace(fullMatch, tokenValue);
      }
    }

    return JSON.parse(retVal);
  }
}
