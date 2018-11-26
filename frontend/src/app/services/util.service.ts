import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import * as jsYaml from 'js-yaml';
import * as yamlJS from 'yaml-js';
import * as aesjs from 'aes-js';
import * as pbkdf2 from 'pbkdf2';
import * as path from 'path';
import * as ms from 'ms';
import * as jwt from 'jsonwebtoken';
import * as boom from 'boom';
import * as FSExtra from 'fs-extra/index';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { ConfigProperty } from 'models/config-property';
import { PROPERTY_VALUE_TYPES, percyConfig } from 'config';
import { Authenticate, User } from 'models/auth';

const aesKey = pbkdf2.pbkdf2Sync(percyConfig.encryptKey, percyConfig.encryptSalt, 1, 32);

/**
 * This service provides the utility methods
 */
@Injectable({ providedIn: 'root' })
export class UtilService {

  // mapping of type from YAML to JSON
  private typeMap = {
    str: 'string',
    int: 'number',
    float: 'number',
    map: 'object',
    seq: 'array',
    bool: 'boolean',
    null: 'string',
  };

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
   * Extract yaml comment.
   * @param comment The comment to extract
   * @returns extracted comment or undefined if it is not a comment
   * @private
   */
  private extractYamlComment(comment: string) {
    const trimmed = _.trim(comment);
    const idx = _.indexOf(trimmed, '#');
    if (!trimmed || idx === -1) {
      // Does not contain '#', it's not a comment, return undefined
      return;
    }
    if (trimmed[idx + 1] === '#') {
      return _.trim(trimmed.substring(idx));
    }
    return _.trim(trimmed.substring(idx + 1));
  }
  
  /**
   * Extract yaml data type.
   * @param comment The comment to extract
   * @returns extracted comment or undefined if it is not a comment
   * @private
   */
  private extractYamlDataType(dataType: string) {
    const trimmed = _.trim(dataType);
    // Extract the data type
    const extracted = trimmed.replace(/^tag:yaml.org,2002:/, '');
  
    // Return extracted data type
    // note if there is more data types need to map then add on mapping of types of YAML and JSON
    return this.typeMap[extracted] ? this.typeMap[extracted] : _.trim(extracted);
  }
  
  /**
   * Parse yaml comments from multiple lines.
   * @param startMark The start mark
   * @param lines The split lines of yaml file
   * @returns parsed comments or undefined if there is not any
   * @private
   */
  private parseYamlCommentLines(startMark, lines: string[]) {
  
    const comments = [];
  
    let lineNum = startMark.line;
    const startLine = lines[lineNum];
    const inlineComment = this.extractYamlComment(startLine.substring(startMark.column + 1));
    if (_.isString(inlineComment)) {
      comments.push(inlineComment);
    }
  
    while (lineNum < lines.length - 1) {
      ++lineNum;
      if (_.isEmpty(_.trim(lines[lineNum]))) {
        continue;
      }
      const match = lines[lineNum].match(/^(\s)*(#.*)/);
      if (match && match[2]) {
        const lineComment = this.extractYamlComment(match[2]);
        comments.push(lineComment);
      } else {
        break;
      }
    }
  
    return comments.length === 0 ? undefined : comments;
  }
  
  /**
   * Set comment to $comment property.
   * @param obj The object to set comment.
   * @param comment The comment
   * @returns object with comment set
   * @private
   */
  private setComment(obj, comment: string[]) {
    if (_.isArray(comment)) {
      if (_.isObject(obj) && !_.isArray(obj)) {
        obj.$comment = comment;
      } else {
        obj = {
          $comment: comment,
          $value: obj,
        };
      }
    }
  
    return obj;
  }
  
  /**
   * Set data type to $type property.
   * @param obj The object to set type.
   * @param type The type
   * @returns object with type set
   * @private
   */
  private setDataType(obj, type: string) {
    if (_.isString(type)) {
      if (_.isObject(obj) && !_.isArray(obj)) {
        obj.$type = type;
      } else {
        obj = {
          $type: type,
          $value: obj,
        };
      }
    }
    if (type === 'object') {
      delete obj.$value;
    }
    return obj;
  }
  
  /**
   * Walk yaml tree, parse comments, construct json object.
   * @param yamlNode The yaml tree node
   * @param lines The split lines of yaml file
   * @returns Json object constructed from yaml tree
   * @private
   */
  private walkYamlTree(yamlNode, lines: string[]) {
    if (yamlNode.id === 'mapping') {
      // Mapping node, represents an object
      const result = {};
  
      _.each(yamlNode.value, ([keyNode, valueNode]) => {
  
        // Recursively walk the value node
        const nestResult = this.walkYamlTree(valueNode, lines);
  
        let comment;
        let type;
        if (valueNode.id !== 'scalar') {
          // This will parse inline comment and after multiple lines comments like:
          // key:  # some inline comment...
          //   # multiple line 1
          //   # multiple line 2
          comment = this.parseYamlCommentLines(keyNode.end_mark, lines);
          type = this.extractYamlDataType(valueNode.tag);
        }
        result[keyNode.value] = this.setDataType(this.setComment(nestResult, comment), type);
      });
  
      return result;
    } else if (yamlNode.id === 'sequence') {
      // Sequence node, represents an array
      let result = [];
  
      _.each(yamlNode.value, (node, idx) => {
        const type = this.extractYamlDataType(node.tag);
        result[idx] = this.setDataType(this.walkYamlTree(node, lines), type);
      });
  
      if (yamlNode.value.length) {
        const comment = this.parseYamlCommentLines(yamlNode.start_mark, lines);
        result = this.setComment(result, comment);
      }
  
      return result;
    } else {
      // Scalar node, represents a string/number..
  
      // This will parse inline comment like:
      // key: value  # some inline comment...
      // const line = lines[yamlNode.end_mark.line];
      // extractYamlComment(line.substring(yamlNode.end_mark.column));
      const comment = this.parseYamlCommentLines(yamlNode.end_mark, lines);
  
      // Parse number if possible
      let value = yamlNode.value;
      const type = this.extractYamlDataType(yamlNode.tag);
      if (type === 'number') {
        value = _.toNumber(value);
      }
  
      if (type === 'boolean') {
        value = JSON.parse(value);
      }
  
      return this.setDataType(this.setComment(value, comment), type);
    }
  }
  
  /**
   * Convert yaml to json object.
   * @param yaml The yaml string
   * @returns json object
   */
  convertYamlToJson(yaml) {
    const yamlNode = yamlJS.compose(yaml);
    const lines = yaml.split(/\r?\n/);
  
    // Walk yaml tree
    const result = !yamlNode ? null : this.walkYamlTree(yamlNode, lines);
  
    // Parse root comments
    let rootComments;
    if (yamlNode) {
      for (let i = 0; i < yamlNode.start_mark.line; i++) {
        const match = lines[i].match(/^(\s)*(#.*)/);
        if ((match && match[2]) || _.isEmpty(lines[i])) {
          // For root comment, keep it as is
          rootComments = rootComments || [];
          rootComments.push(lines[i]);
        }
      }
    }
  
    return this.setComment(result, rootComments);
  }

  /**
   * Render yaml comment.
   * @param comment The comment to render
   * @returns the comment rendered
   */
  private renderYamlComment(comment: string) {
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
  private walkJsonTree(jsonNode, indent: string = '') {

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
          value = value.replace(/\"/g, '\\"');
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
    const regexPattern =
      `${this.escapeRegExp(percyConfig.variableSubstitute.prefix)}(.+?)${this.escapeRegExp(percyConfig.variableSubstitute.suffix)}`;
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
            const tokenValue = result[tokenName];

            if (typeof tokenValue === 'string') {
              if (this.createRegExp().exec(tokenValue)) {
                referenceFound = true;
                this.addReference(referenceLinks, key, tokenName);
                continue;
              }
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
      const tokenValue = tokens[tokenName];

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

  /**
   * Encrypt.
   * @param text The text to encrypt
   * @returns encrypted text
   */
  encrypt(text: string): string {
    const textBytes = aesjs.utils.utf8.toBytes(text);
  
    const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
    const encryptedBytes = aesCtr.encrypt(textBytes);
  
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }
  
  /**
   * Decrypt.
   * @param encrypted The encrypted text
   * @returns decrypted text
   */
  decrypt(encrypted: string): string {
    const encryptedBytes = aesjs.utils.hex.toBytes(encrypted);
  
    const aesCtr = new aesjs.ModeOfOperation.ctr(aesKey);
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
  
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }
  
  /**
   * Convert Git error.
   * @param err The Git error
   * @returns converted error
   */
  convertGitError(err) {
  
    if (err && err.data && err.data.statusCode === 401) {
      return boom.unauthorized('Invalid username or password');
    }
  
    if (err && err.data && err.data.statusCode === 403) {
      return boom.forbidden('Git authorization forbidden');
    }
  
    if (err && err.data && err.data.statusCode === 404) {
      return boom.notFound('Repository not found');
    }
  
    const resultErr = boom.boomify(err);
    resultErr.data = err.data;
    resultErr['code'] = err.code;

    return resultErr;
  }

  /**
   * Get repo name.
   * @param url The repo url
   * @returns the repo name
   */
  getRepoName(url: URL) {
    const split = url.pathname.split('/');
    return split.filter((e) => e).join('/');
  }

  /**
   * Get repo folder name.
   * @param user The user contains username, repo name and branch name
   * @returns the repo folder name
   */
  getRepoFolder(auth: Authenticate) {
    const repoName = this.getRepoName(new URL(auth.repositoryUrl));

    // Construct folder name by combining username, repoName and branchName
    const repoFolder =  encodeURIComponent(`${auth.username}!${repoName}!${auth.branchName}`);
    return {repoName, repoFolder};
  }
  
  /**
   * Get metadata file path.
   * @param repoFolder The repo folder name
   * @returns the path to metadata file
   */
  getMetadataPath(repoFolder: string) {
    return path.resolve(percyConfig.metaFolder, `${repoFolder}.meta`);
  }

  authenticate(auth: Authenticate): User {
    const {repoName, repoFolder} = this.getRepoFolder(auth);

    // Create token payload
    const tokenPayload: any = {
      username: auth.username,
      iat: Math.floor(Date.now() / 1000),
    };
    tokenPayload.exp = tokenPayload.iat + Math.floor(ms(percyConfig.jwtExpiresIn) / 1000);

    // Sign token and set to repo metadata
    const token = jwt.sign(tokenPayload, percyConfig.jwtSecret);
    const validUntil = new Date(tokenPayload.exp * 1000).getTime();

    const user: User = {
      ...auth,
      password: this.encrypt(auth.password),
      repoName,
      repoFolder,
      token,
      validUntil,
    };

    return user;
  }

  async checkRepoAccess(user: User, fs: typeof FSExtra): Promise<User> {
    if (!user || !user.token) {
      throw boom.unauthorized('Miss access token');
    }

    try {
      jwt.verify(user.token, percyConfig.jwtSecret);
    } catch (jwtErr) {
      throw boom.unauthorized(jwtErr.name === 'TokenExpiredError' ? 'Expired access token' : 'Invalid access token');
    }

    const repoMetadataFile = this.getMetadataPath(user.repoFolder);
    if (!await fs.exists(repoMetadataFile)) {
      throw boom.unauthorized('Repo metadata not found');
    }

    let repoMetadata: any = await fs.readFile(repoMetadataFile);
    try {
      repoMetadata = JSON.parse(repoMetadata.toString());
    } catch (err) {
      // Not a valid json format, repo metadata file corruption, remove it
      console.warn(`${repoMetadataFile} file corruption, will be removed:\n${repoMetadata}`);
      await fs.remove(repoMetadataFile);
      throw boom.unauthorized('Repo metadata file corruption');
    }

    // Verify with repo metadata
    if (!_.isEqual(_.omit(user, 'password'), _.omit(repoMetadata, 'password'))) {
      throw boom.forbidden('Repo metadata mismatch, you are not allowed to access the repo');
    }

    return {...user, password: this.decrypt(repoMetadata.password)};
  }
}
