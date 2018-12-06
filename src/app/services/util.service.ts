import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as fs from 'fs-extra';
import * as jsYaml from 'js-yaml';
import * as yamlJS from 'yaml-js';
import * as aesjs from 'aes-js';
import * as pbkdf2 from 'pbkdf2';
import * as path from 'path';
import * as boom from 'boom';
import * as cheerio from 'cheerio';
import * as _ from 'lodash';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { PROPERTY_VALUE_TYPES, percyConfig } from 'config';
import { Authenticate } from 'models/auth';

import * as filesystem from 'filesystem';
import { AbstractControl } from '@angular/forms';

export const git = filesystem.git;
export type FS = typeof fs;

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
  constructor(private http: HttpClient) { }

  /**
   * Init config.
   */
  async initConfig() {
    if (_.isEmpty(percyConfig)) {
      const config = await this.http.get('/percy.conf.json').toPromise();
      _.assign(percyConfig, config);
    }
  }

  /**
   * Get browser filesytem.
   */
  async getBrowserFS() {

    if (filesystem.initialized()) {
      return fs;
    }

    await this.initConfig();

    await filesystem.initialize();

    await fs.ensureDir(percyConfig.reposFolder);
    await fs.ensureDir(percyConfig.draftFolder);
    await fs.ensureDir(percyConfig.metaFolder);

    console.info('Browser Git initialized'); // tslint:disable-line
    return fs;
  }

  /**
   * Extract yaml comment.
   * @param comment The comment to extract
   * @returns extracted comment or undefined if it is not a comment
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
   * Walk yaml tree, parse comments, construct TreeNode object.
   * @param keyNode The yaml key node
   * @param valueNode The yaml value node
   * @param lines The split lines of yaml file
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns TreeNode object constructed from yaml tree
   */
  private walkYamlNode(keyNode, valueNode, lines: string[], simpleArray: boolean) {
    const type = this.extractYamlDataType(valueNode.tag);
    if (type === 'object') {
      // Mapping node, represents an object
      const result = new TreeNode(keyNode ? keyNode.value : '', type);

      _.each(valueNode.value, ([subKeyNode, subValueNode]) => {
        // Recursively walk the value node
        result.addChild(this.walkYamlNode(subKeyNode, subValueNode, lines, simpleArray));
      });

      // This will parse inline comment and after multiple lines comments like:
      // key:  # some inline comment...
      //   # multiple line 1
      //   # multiple line 2
      if (keyNode && keyNode.end_mark) {
        result.comment = this.parseYamlCommentLines(keyNode.end_mark, lines);
      }

      return result;
    } else if (type === 'array') {
      // Sequence node, represents an array
      const result = new TreeNode(keyNode ? keyNode.value : '', type);

      result.comment = this.parseYamlCommentLines(valueNode.start_mark, lines);

      const children: TreeNode[] = [];
      _.each(valueNode.value, (subValueNode, idx) => {
        children.push(this.walkYamlNode({ value: `[${idx}]` }, subValueNode, lines, simpleArray));
      });

      if (!simpleArray) {
        children.forEach((item) => {
          result.addChild(item);
        });
      } else {
        let itemType;
        children.forEach((item) => {
          if (!item.isLeaf()) {
            console.warn(`Only support array of simple type, but got: ${item.valueType}`);
            return;
          }
          if (!itemType) {
            itemType = item.valueType;
          } else if (itemType !== item.valueType) {
            console.warn(`Only support array of items with same type, ${itemType} already detected, and got: ${item.valueType}`);
            return;
          }
          result.addChild(item);
        });

        itemType = itemType || PROPERTY_VALUE_TYPES.STRING;
        switch (itemType) {
          case PROPERTY_VALUE_TYPES.STRING:
            result.valueType = PROPERTY_VALUE_TYPES.STRING_ARRAY;
            break;
          case PROPERTY_VALUE_TYPES.BOOLEAN:
            result.valueType = PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY;
            break;
          case PROPERTY_VALUE_TYPES.NUMBER:
            result.valueType = PROPERTY_VALUE_TYPES.NUMBER_ARRAY;
            break;
        }
      }

      return result;
    } else {
      // Scalar node, represents a string/number..
      const result = new TreeNode(keyNode ? keyNode.value : '', type);

      // This will parse inline comment like:
      // key: value  # some inline comment...
      result.comment = this.parseYamlCommentLines(valueNode.end_mark, lines);

      // Parse number if possible
      if (result.valueType === 'number') {
        result.value = _.toNumber(valueNode.value);
      } else if (result.valueType === 'boolean') {
        result.value = JSON.parse(valueNode.value);
      } else {
        result.value = valueNode.value;
      }

      return result;
    }
  }

  /**
   * Convert yaml to TreeNode object.
   * @param yaml The yaml string
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns TreeNode object
   */
  convertYamlToTree(yaml: string, simpleArray: boolean = true) {
    const yamlNode = yamlJS.compose(yaml);
    const lines = yaml.split(/\r?\n/);

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

    // Walk yaml tree
    const result = !yamlNode ? null : this.walkYamlNode(null, yamlNode, lines, simpleArray);
    result.comment = rootComments;
    return result;
  }

  /**
   * Parse yaml to Configuration object.
   * @param yaml The yaml string
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns Configuration object
   */
  parseYamlConfig(yaml: string, simpleArray: boolean = true) {
    return Configuration.fromTreeNode(this.convertYamlToTree(yaml, simpleArray));
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
   * Walk TreeNode, convert to yaml format.
   * @param treeNode The TreeNode
   * @param indent The indent spaces
   * @returns Yaml format string
   */
  private walkTreeNode(treeNode: TreeNode, indent: string = '') {

    let result = '';

    _.each(treeNode.children, (child) => {

      if (treeNode.isArray()) {
        result += indent + '-';
      } else {
        result += indent + child.key + ':';
      }

      // Extract comment
      const comment = child.comment;
      const hasComment = child.comment && child.comment.length > 0;

      let type = child.valueType;
      if (child.isArray()) {
        result += ' !!seq';
      } else {
        if (type === PROPERTY_VALUE_TYPES.NUMBER && _.isInteger(child.value)) {
          type = 'int';
        } else {
          type = this.typeMapReverse[type];
        }
        if (!treeNode.isArray() || type !== 'map') {
          result += ' !!' + type;
        }
      }

      if (!child.isLeaf()) {
        // Append inline comment and multiple lines comments
        if (hasComment) {
          result += this.renderYamlComment(comment[0]);

          for (let i = 1; i < comment.length; i++) {
            result += '\n' + indent + this.renderYamlComment(comment[i]);
          }
        }
        // Recursively walk the children nodes
        const nestResult = this.walkTreeNode(child, indent + '  ');
        result += treeNode.isArray() && !child.isArray() ? ' ' + _.trimStart(nestResult) : '\n' + nestResult;
      } else {
        let value = child.value;

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
   * Convert TreeNode object to yaml format.
   * @param tree The TreeNode object
   * @returns Yaml format string
   */
  convertTreeToYaml(tree: TreeNode) {
    if (_.isEmpty(tree.children)) {
      return tree.isArray() ? '[]' : '{}';
    }

    let result = '';

    if (tree.comment) {
      // Add root comments
      _.each(tree.comment, (comment) => {
        if (/^(\s)*(#.*)/.test(comment) || _.isEmpty(comment)) {
          result += comment + '\n';
        }
      });
    }

    result += this.walkTreeNode(tree);
    result = _.trim(result);

    try {
      // Validate against safe schema
      jsYaml.safeLoad(result, { strict: true });
    } catch (err) {
      throw err;
    }

    return result;
  }

  /**
   * Escape reg exp.
   *
   * @param text the text might contain reg exp to escape
   * @returns escaped text
   */
  private escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  /**
   * Create regexp for variable reference based on percy config.
   *
   * @param appPercyConfig the application's specific percy config
   * @returns regexp for variable reference
   */
  createRegExp(appPercyConfig: any = {}) {
    const prefix = _.defaultTo(appPercyConfig.variablePrefix, percyConfig.variableSubstitutePrefix);
    const suffix = _.defaultTo(appPercyConfig.variableSuffix, percyConfig.variableSubstituteSuffix);
    const regexPattern = `${this.escapeRegExp(prefix)}(.+?)${this.escapeRegExp(suffix)}`;
    return new RegExp(regexPattern, 'g');
  }

  /**
   * When resolve token variable references, we collect them to detect loop reference.
   * @param referenceLinks the collected reference links
   * @param refFrom the reference from (left side)
   * @param refTo the reference to (right side)
   * @throws Error if loop reference detected
   */
  private addTokenReference(referenceLinks, refFrom, refTo) {
    if (refFrom === refTo) {
      throw new Error('Loop variable reference: ' + [refFrom, refTo].join('->'));
    }

    let added = false;

    _.each(referenceLinks, referenceLink => {
      if (referenceLink[referenceLink.length - 1] !== refFrom) {
        return;
      }

      const idx = referenceLink.indexOf(refTo);
      if (idx > -1) {
        const cyclic = referenceLink.slice(idx);
        cyclic.push(refTo);
        throw new Error('Loop variable reference: ' + cyclic.join('->'));
      }
      referenceLink.push(refTo);
      added = true;
    });

    if (!added) {
      referenceLinks.push([refFrom, refTo]);
    }
  }

  /**
   * Tokens (which are top level properties of default config) can also be variable and reference each other.
   * This method resolves them.
   *
   * @param tokens the tokens to resolves
   * @param appPercyConfig the application's specific percy config
   * @returns the resolved tokens
   */
  private resolveTokens(tokens, appPercyConfig) {
    const result = _.cloneDeep(tokens);
    const referenceLinks = [];

    while (true) {
      let referenceFound = false;

      _.each(result, (value, key) => {
        if (typeof value !== 'string') {
          return;
        }

        let retValue = value;

        const regExp = this.createRegExp(appPercyConfig);
        let regExpResult;

        while (regExpResult = regExp.exec(value)) {

          const fullMatch = regExpResult[0];
          const tokenName = regExpResult[1];
          const tokenValue = result[tokenName];

          if (typeof tokenValue === 'string') {
            if (this.createRegExp(appPercyConfig).exec(tokenValue)) {
              referenceFound = true;
              this.addTokenReference(referenceLinks, key, tokenName);
              continue;
            }
          }

          retValue = retValue.replace(fullMatch, tokenValue);
        }

        result[key] = retValue;
      });

      if (!referenceFound) {
        break;
      }
    }

    return result;
  }

  /**
   * Yaml config can contain variable reference.
   * This method rescusively substitues the variable references.
   *
   * @param target the config to substitue
   * @param tokens the tokens (which are top level properties of default config)
   * @param appPercyConfig the application's specific percy config
   * @param depth the depth of config
   * @returns the substitued config
   */
  private substitute(target: TreeNode, tokens, appPercyConfig, depth) {
    if (target.valueType === PROPERTY_VALUE_TYPES.OBJECT) {
      _.each(target.children, (child) => {
        if (depth === 0 && child.isLeaf() && _.has(tokens, child.key)) {
          child.value = tokens[child.key];
        } else {
          this.substitute(child, tokens, appPercyConfig, depth++);
        }
      });
      return target;
    }

    if (target.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY
      || target.valueType === 'array') {
      _.each(target.children, (child) => {
        this.substitute(child, tokens, appPercyConfig, depth++);
      });
      return target;
    }

    if (target.valueType !== PROPERTY_VALUE_TYPES.STRING) {
      return target;
    }

    const text = target.value;
    let retVal = text;

    const regExp = this.createRegExp(appPercyConfig);
    let regExpResult;
    while (regExpResult = regExp.exec(text)) {
      const fullMatch = regExpResult[0];
      const tokenName = regExpResult[1];
      const tokenValue = tokens[tokenName];

      retVal = retVal.replace(fullMatch, tokenValue);
    }
    target.value = retVal;
    return target;
  }

  /**
   * Environment and inherit another environment.
   * This method merges environment.
   *
   * @param dest the dest environment to merge to
   * @param src the source environment to merge from
   */
  private mergeEnv(dest: TreeNode, src: TreeNode) {
    if (dest.isLeaf()) {
      const match = src.findChild(dest.getPathsWithoutRoot());
      if (match) {
        dest.value = match.value;
        dest.comment = match.comment || dest.comment;
      }
    } else if (dest.isArray()) {
      const match = src.findChild(dest.getPathsWithoutRoot());
      if (match) {
        dest.comment = match.comment || dest.comment;
        // Copy array
        dest.children = [];
        const arr = _.cloneDeep(match.children);
        _.each(arr, item => {
          item.parent = null;
          dest.addChild(item);
        });
      }
    } else {
      dest.comment = src.comment || dest.comment;
      _.each(dest.children, subChild => {
        this.mergeEnv(subChild, src);
      });
    }
  }

  /**
   * Compile yaml for given environment.
   * @param env the environment name
   * @param config the configuration object
   * @param appPercyConfig the application's specific percy config
   * @returns compiled yaml string
   */
  compileYAML(env: string, config: Configuration, appPercyConfig?) {
    const mergeStack = [];
    const inheritedEnvs = [env];

    let envNode = config.environments.findChild([env]);
    while (envNode) {
      const deepCopy = _.cloneDeep(envNode);
      const inherits = deepCopy.findChild(['inherits']);
      mergeStack.unshift(deepCopy);
      if (inherits) {
        _.remove(deepCopy.children, v => v === inherits);
        const inheritEnv = inherits.value;
        if (inheritedEnvs.indexOf(inheritEnv) > -1) {
          throw new Error('Cylic env inherits detected!');
        }
        inheritedEnvs.push(inheritEnv);
        envNode = config.environments.findChild([inheritEnv]);
      } else {
        break;
      }
    }

    const merged = _.cloneDeep(config.default);
    mergeStack.forEach(m => {
      this.mergeEnv(merged, m);
    });

    let tokens = {};
    _.each(merged.children, (child) => {
      if (child.isLeaf()) {
        tokens[child.key] = child.value;
      }
    });

    tokens = this.resolveTokens(tokens, appPercyConfig);

    const substituted = this.substitute(merged, tokens, appPercyConfig, 0);
    substituted.key = env;

    return this.convertTreeToYaml(substituted);
  }

  /**
   * Highlight variable within yaml text string value
   * @param text the yaml text string value
   * @param appPercyConfig the application's specific percy config
   * @param parentSpan the parent span node contains the text
   * @returns span element with variable highlighted, or given parent span if there is no variable found
   */
  highlightVariable(text: string, appPercyConfig: any = {}, parentSpan?: Cheerio) {
    const prefix = _.defaultTo(appPercyConfig.variablePrefix, percyConfig.variableSubstitutePrefix);

    // Find out the variable token, wrap it in '<span class="yaml-var">${tokenName}</span>'
    let leftIdx = 0;
    let regExpResult;
    let newSpan: Cheerio = null;
    const $ = cheerio.load('');
    const regExp = this.createRegExp(appPercyConfig);
    while (regExpResult = regExp.exec(text)) {
      if (!newSpan) {
        newSpan = $('<span class="hljs-string"></span>');
      }
      const tokenName = regExpResult[1];

      // Append left side plus variable substitute prefix
      newSpan.append($('<span></span>').text(text.slice(leftIdx, regExpResult.index) + prefix));
      // Append variable token name
      newSpan.append($('<span class="yaml-var"></span>').text(tokenName));
      // Update index
      leftIdx = regExpResult.index + prefix.length + tokenName.length;
    }

    if (newSpan) {
      // Append string left
      newSpan.append($('<span></span>').text(text.slice(leftIdx)));
      return newSpan;
    }
    return parentSpan ? parentSpan : $('<span></span>').text(text);
  }

  /**
   * Highlight variable within yaml text string value in a TreeNode
   * @param node the string TreeNode to highlight its value
   * @param appPercyConfig the application's specific percy config
   * @returns html rendered with highlighted variable
   */
  highlightNodeVariable(node: TreeNode, appPercyConfig?) {
    if (node.valueType !== PROPERTY_VALUE_TYPES.STRING) {
      return node.value;
    }
    const span = this.highlightVariable(_.defaultTo(node.value, ''), appPercyConfig);
    return span.html();
  }

  /**
   * Encrypt.
   * @param text The text to encrypt
   * @returns encrypted text
   */
  encrypt(text: string): string {
    const textBytes = aesjs.utils.utf8.toBytes(text);
    const aesKey = pbkdf2.pbkdf2Sync(percyConfig.encryptKey, percyConfig.encryptSalt, 1, 32);

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
    const aesKey = pbkdf2.pbkdf2Sync(percyConfig.encryptKey, percyConfig.encryptSalt, 1, 32);

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
  private getRepoName(url: URL) {
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
    const repoFolder = encodeURIComponent(`${auth.username}!${repoName}!${auth.branchName}`);
    return { repoName, repoFolder };
  }

  /**
   * Get metadata file path.
   * @param repoFolder The repo folder name
   * @returns the path to metadata file
   */
  getMetadataPath(repoFolder: string) {
    return path.resolve(percyConfig.metaFolder, `${repoFolder}.meta`);
  }
}

export function NotEmpty(control: AbstractControl) {
  if (!_.trim(control.value)) {
    return { required: true };
  }
  return null;
}
