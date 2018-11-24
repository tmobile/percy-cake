import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import * as jsYaml from 'js-yaml';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { ConfigProperty } from 'models/config-property';
import { PROPERTY_VALUE_TYPES, VARIABLE_SUBSTITUTE } from 'config';

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
          value = value.replace(/\\/g, '\\\\');
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
    this.doUpdateJsonValue(node.getTopParent());
  }

  private escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  private createRegExp() {
    const regexPattern = `${this.escapeRegExp(VARIABLE_SUBSTITUTE.PREFIX)}(.+?)${this.escapeRegExp(VARIABLE_SUBSTITUTE.SUFFIX)}`;
    return new RegExp(regexPattern, 'g');
  }

  private addReference(referenceLinks, refBy, ref) {
    if (refBy === ref) {
      throw new Error('Loop variable reference: ' + [refBy, ref].join('->'));
    }
    let added = false;
    _.each(referenceLinks, referenceLink => {
      if (referenceLink[referenceLink.length - 1] === refBy) {
        const idx = referenceLink.indexOf(ref);
        if (idx > -1) {
          const cyclic = referenceLink.slice(idx);
          cyclic.push(ref);
          throw new Error('Loop variable reference: ' + cyclic.join('->'));
        }
        referenceLink.push(ref);
        added = true;
      }
    });

    if (!added) {
      referenceLinks.push([refBy, ref]);
    }
  }

  private resolveTokens(tokens) {
    const result = _.cloneDeep(tokens);
    const referenceLinks = [];

    while (true) {
      let referenceFound = false;

      _.each(result, (value, key) => {
        let retValue = value;

        if (typeof value === 'string') {
          const regExp = this.createRegExp();
          let regExpResult;
          while (regExpResult = regExp.exec(value)) {

            const fullMatch = regExpResult[0];
            const tokenName = regExpResult[1];
            let tokenValue = result[tokenName];

            if (typeof tokenValue === 'string') {
              if (this.createRegExp().exec(tokenValue)) {
                referenceFound = true;
                this.addReference(referenceLinks, key, tokenName);
                continue;
              }
              tokenValue = tokenValue.replace(/"/g, '\\"');
            }

            retValue = retValue.replace(fullMatch, tokenValue);
          }
        }

        result[key] = retValue;
      });

      if (!referenceFound) {
        break;
      }
    }

    return result;
  }

  private substitute(target, tokens, depth) {
    if (target.$type === PROPERTY_VALUE_TYPES.OBJECT) {
      _.each(target, (item, key) => {
        if (depth === 0 && item.$type && _.has(tokens, key)) {
          item.$value = tokens[key];
        } else {
          this.substitute(item, tokens, depth++);
        }
      });
      return target;
    }

    if (target.$type === PROPERTY_VALUE_TYPES.STRING_ARRAY
      || target.$type === 'array') {
      _.each(target.$value, (item) => {
        this.substitute(item, tokens, depth++);
      });
      return target;
    }

    if (target.$type !== PROPERTY_VALUE_TYPES.STRING) {
      return target;
    }

    const text = target.$value;
    let retVal = text;

    const regExp = this.createRegExp();
    let regExpResult;
    while (regExpResult = regExp.exec(text)) {
      const fullMatch = regExpResult[0];
      const tokenName = regExpResult[1];
      let tokenValue = tokens[tokenName];

      if (typeof tokenValue === 'string') {
        tokenValue = tokenValue.replace(/"/g, '\\"');
      }

      retVal = retVal.replace(fullMatch, tokenValue);
    }
    target.$value = retVal;
    return target;
  }

  compileYAML(env: string, config: Configuration) {
    const mergeStack = [];

    let envNode = config.environments[env] || {};
    while (envNode) {
      const deepCopy = _.cloneDeep(envNode);
      const inherits = deepCopy.inherits;
      delete deepCopy.inherits;
      mergeStack.unshift({[env]: deepCopy});
      if (inherits) {
        const inheritEnv = inherits.$value;
        if (inheritEnv === env) {
          throw new Error('Cylic env inherits detected!');
        }
        envNode = config.environments[inheritEnv];
      } else {
        break;
      }
    }

    mergeStack.unshift({[env]: _.cloneDeep(config.default)});

    let merged = {};
    mergeStack.forEach(m => {
      merged = _.mergeWith(merged, m, (dst, src) => {
        if (_.isArray(dst)) {
          // Copy array instead of merge
          return src;
        }
      });
    });

    const tokens = {};
    _.each(merged[env], (value, key) => {
      if (value && TreeNode.isLeafType(value.$type)) {
        tokens[key] = value.$value;
      }
    });

    const substituted = this.substitute(merged[env], this.resolveTokens(tokens), 0);

    return this.convertJsonToYaml(substituted);
  }
}
