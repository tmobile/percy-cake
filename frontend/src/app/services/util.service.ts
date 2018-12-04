import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as jsYaml from 'js-yaml';
import * as yamlJS from 'yaml-js';
import * as aesjs from 'aes-js';
import * as pbkdf2 from 'pbkdf2';
import * as path from 'path';
import * as boom from 'boom';
import * as BrowserFS from 'browserfs';
import * as Git from 'isomorphic-git';
import * as legacy from 'graceful-fs/legacy-streams';
import * as FsExtra from 'fs-extra/index';
import * as _ from 'lodash';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { PROPERTY_VALUE_TYPES, percyConfig } from 'config';
import { Authenticate } from 'models/auth';

export const git = { ...Git };
export type FSExtra = typeof FsExtra;

// BrowserFS miss ReadStream/WriteStream, patch them
const bfs = BrowserFS.BFSRequire('fs');
const streams = legacy(bfs);
bfs['ReadStream'] = streams.ReadStream;
bfs['WriteStream'] = streams.WriteStream;

// Patch fs with fs-extra
const fsExtra = require('fs-extra');

// For readFile/writeFile/appendFile, fs-extra has problem with BrowserFS
// when passing null options
// (Here we don't care callback because we'll always use promise)
const fs$readFile = fsExtra.readFile;
fsExtra.readFile = function (path, options) {
  return fs$readFile(path, options || {});
};

const fs$writeFile = fsExtra.writeFile;
fsExtra.writeFile = function (path, data, options) {
  return fs$writeFile(path, data, options || {});
};

const fs$appendFile = fsExtra.appendFile;
fsExtra.appendFile = function (path, data, options) {
  return fs$appendFile(path, data, options || {});
};

// BrowserFS synchronous file system (like InMemory) has issue
// to bypass zone.js promise handling
const patchSynchronousFS = (synFileSystem, func) => {
  const existFunc = synFileSystem[func];

  synFileSystem[func] = (...args) => {
    const callback = args[args.length - 1];

    args[args.length - 1] = (error, result) => {
      // Use setImmediate to join the zone.js promise
      setImmediate(() => callback(error, result));
    };

    existFunc.apply(synFileSystem, args);
  }
}

/**
 * This service provides the utility methods
 */
@Injectable({ providedIn: 'root' })
export class UtilService {

  private browserFSInitialized = false;

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
  async getBrowserFS(): Promise<FSExtra> {

    if (this.browserFSInitialized) {
      return fsExtra;
    }

    await this.initConfig();

    await new Promise<void>((resolve, reject) => {
    
      BrowserFS.configure(
        {
          fs: "AsyncMirror",
          options: {
            sync: { fs: "InMemory" },
            async: { fs: "IndexedDB", options: {storeName: percyConfig.storeName} }
          },
        },
        async function (err) {
          if (err) {
            console.error(err);
            return reject(err);
          };

          // Root FS of AsyncMirror is a synchronous InMemory FS, patch it
          const rootFS = bfs.getRootFS();
          const methods = ['rename', 'stat', 'exists', 'open', 'unlink', 'rmdir', 'mkdir', 'readdir'];
          methods.forEach(m => {
            patchSynchronousFS(rootFS, m);
          });
    
          git.plugins.set('fs', bfs);
    
          await fsExtra.ensureDir(percyConfig.reposFolder);
          await fsExtra.ensureDir(percyConfig.draftFolder);
          await fsExtra.ensureDir(percyConfig.metaFolder);
    
          console.info('Browser Git initialized');
          resolve();
        }
      );
    });

    this.browserFSInitialized = true;
    return fsExtra;
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
   * Walk yaml tree, parse comments, construct TreeNode object.
   * @param keyNode The yaml key node
   * @param valueNode The yaml value node
   * @param lines The split lines of yaml file
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns TreeNode object constructed from yaml tree
   * @private
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
        children.push(this.walkYamlNode({value: `[${idx}]`}, subValueNode, lines, simpleArray));
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
          default:
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
      console.error('Error while parsing configuration to yaml', err);
      throw err;
    }

    return result;
  }

  private escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  private createRegExp() {
    const regexPattern =
      `${this.escapeRegExp(percyConfig.variableSubstitutePrefix)}(.+?)${this.escapeRegExp(percyConfig.variableSubstituteSuffix)}`;
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

  private substitute(target: TreeNode, tokens, depth) {
    if (target.valueType === PROPERTY_VALUE_TYPES.OBJECT) {
      _.each(target.children, (child) => {
        if (depth === 0 && child.isLeaf() && _.has(tokens, child.key)) {
          child.value = tokens[child.key];
        } else {
          this.substitute(child, tokens, depth++);
        }
      });
      return target;
    }

    if (target.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY
      || target.valueType === 'array') {
      _.each(target.children, (child) => {
        this.substitute(child, tokens, depth++);
      });
      return target;
    }

    if (target.valueType !== PROPERTY_VALUE_TYPES.STRING) {
      return target;
    }

    const text = target.value;
    let retVal = text;

    const regExp = this.createRegExp();
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

  compileYAML(env: string, config: Configuration) {
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

    let merged = _.cloneDeep(config.default);
    mergeStack.forEach(m => {
      this.mergeEnv(merged, m);
    });

    const tokens = {};
    _.each(merged.children, (child) => {
      if (child.isLeaf()) {
        tokens[child.key] = child.value;
      }
    });

    const substituted = this.substitute(merged, this.resolveTokens(tokens), 0);
    substituted.key = env;

    const tree = new TreeNode('');
    tree.children.push(substituted);
    return this.convertTreeToYaml(tree);
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
}
