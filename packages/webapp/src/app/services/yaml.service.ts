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

import * as jsYaml from "js-yaml";
import * as yamlJS from "yaml-js";
import * as _ from "lodash";
import * as cheerio from "cheerio";

import { PROPERTY_VALUE_TYPES, percyConfig, appPercyConfig } from "config";
import { TreeNode } from "models/tree-node";
import { Configuration, EnvsVariablesConfig, VariableConfig } from "models/config-file";
import { Injectable } from "@angular/core";

export interface ValueConfig {
  text: string;
  variableConfig?: VariableConfig;
}

const _LOOP_ = "___LOOP___";

class YamlParser {
  // mapping of type from YAML to JSON
  private typeMap = {
    str: "string",
    int: "number",
    float: "number",
    map: "object",
    seq: "array",
    bool: "boolean",
    null: "string"
  };

  // The cursor of events
  private cursor = 0;

  // The events from yaml-js parsing
  private events: any[];

  // The lines
  private lines: string[];

  // The anchors
  private anchors: { [key: string]: TreeNode } = {};

  // Root indicator
  private root = true;

  // The flag indicates whether only supports simple array which has same item type
  private simpleArray = true;

  /**
   * Constructor.
   */
  constructor() {}

  /**
   * Get event and forward cursor to next.
   * @param forward Flag indicates whether to forward cursor
   */
  private getEvent(forward: boolean = true) {
    const result = this.events[this.cursor];
    if (forward) {
      this.cursor++;
    }
    return result;
  }

  /**
   * Peek event without forwarding cursor.
   */
  private peekEvent() {
    return this.getEvent(false);
  }

  /**
   * Parse yaml.
   * @param yaml The yaml string
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns TreeNode parsed.
   */
  public parse(yaml: string, simpleArray: boolean = true) {
    try {
      this.events = yamlJS.parse(yaml);
    } catch (err) {
      throw new Error(
        `${err.problem} ${err.context} on line ${err.problem_mark.line +
          1}, column ${err.problem_mark.column + 1}`
      );
    }
    this.lines = yaml.split(/\r?\n/);
    this.cursor = 0;
    this.anchors = {};
    this.root = true;
    this.simpleArray = simpleArray;

    // Skip StreamStartEvent and DocumentStartEvent
    this.getEvent();
    this.getEvent();

    return this.parseEvent();
  }

  /**
   * Parse event.
   * @returns TreeNode parsed.
   */
  private parseEvent() {
    const event = this.peekEvent();
    if (event instanceof yamlJS.events.AliasEvent) {
      return this.parseAliasEvent();
    }

    let result: TreeNode;
    if (event instanceof yamlJS.events.ScalarEvent) {
      result = this.parseScalarEvent();
    } else if (event instanceof yamlJS.events.SequenceStartEvent) {
      result = this.parseSequenceEvent();
    } else if (event instanceof yamlJS.events.MappingStartEvent) {
      result = this.parseMappingEvent();
    }

    const anchor = event && event.anchor;
    if (anchor) {
      if (this.anchors[anchor]) {
        throw new Error(`Found duplicate anchor: ${anchor}`);
      }
      result.anchor = anchor;
      this.anchors[anchor] = result;
    }

    return result;
  }

  /**
   * Parse alias event.
   * @returns TreeNode parsed.
   */
  private parseAliasEvent() {
    const event = this.getEvent();

    const anchor = event.anchor;
    const anchorNode = this.anchors[anchor];
    if (!anchorNode) {
      throw new Error(`Found undefined anchor: ${anchor}`);
    }

    const result = new TreeNode("", anchorNode.valueType);
    result.aliases = [anchor];
    this.parseComment(result, event.start_mark);
    return result;
  }

  /**
   * Parse mapping event.
   * @returns TreeNode parsed.
   */
  private parseMappingEvent() {
    const result = new TreeNode("");
    let event = this.getEvent();
    this.parseComment(result, event.start_mark);

    event = this.peekEvent();
    while (!(event instanceof yamlJS.events.MappingEndEvent)) {
      const keyNode = this.parseScalarEvent(true);
      const valueNode = this.parseEvent();

      valueNode.key = keyNode.value;

      if (valueNode.key === "<<" && valueNode.aliases) {
        result.aliases = result.aliases || [];
        result.aliases.push(...valueNode.aliases);
      } else {
        result.addChild(valueNode);
      }

      event = this.peekEvent();
    }
    this.getEvent();

    return result;
  }

  /**
   * Parse sequence event.
   * @returns TreeNode parsed.
   */
  private parseSequenceEvent() {
    const result = new TreeNode("", "array");
    let event = this.getEvent();
    this.parseComment(result, event.start_mark);

    let idx = 0;
    let itemType: string;

    event = this.peekEvent();
    while (!(event instanceof yamlJS.events.SequenceEndEvent)) {
      const child = this.parseEvent();
      child.key = `[${idx++}]`;

      if (!this.simpleArray) {
        result.addChild(child);
      } else {
        const valueType = child.valueType;

        if (!itemType) {
          itemType = valueType;
        }

        if (itemType !== valueType) {
          console.warn(
            `Only support array of items with same type, ${itemType} already detected, and got: ${valueType}`
          );
        } else {
          result.addChild(child);
        }
      }

      event = this.peekEvent();
    }

    if (this.simpleArray) {
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
          result.valueType = PROPERTY_VALUE_TYPES.OBJECT_ARRAY;
          break;
      }
    }

    this.getEvent();
    return result;
  }

  /**
   * Parse scalar event.
   * @param forKeyNode Flag indicates whether this scalar event is for key node
   * @returns TreeNode parsed.
   */
  private parseScalarEvent(forKeyNode: boolean = false) {
    const event = this.getEvent();
    const yamlType = this.extractYamlDataType(event.tag);
    let type = this.convertYamlDataType(yamlType);
    if (
      !forKeyNode &&
      (!type || type === "number") &&
      !event.style &&
      event.value
    ) {
      try {
        const loaded = yamlJS.load(
          `value: ${yamlType ? "!!" + yamlType + " " : ""}${event.value}`
        );
        const value = loaded["value"];
        if (_.isNumber(value)) {
          type = "number";

          if (
            value === Number.POSITIVE_INFINITY ||
            value === Number.NEGATIVE_INFINITY ||
            _.isNaN(value)
          ) {
            event.value = value;
          } else if (
            _.isInteger(value) &&
            event.value.indexOf("e") < 0 &&
            event.value.indexOf(".") < 0
          ) {
            event.value = value;
          }
        }
      } catch (err) {
        console.error(err); // ignore it
      }
    }
    type = type || "string";
    const result = new TreeNode("", type);

    // Parse number if possible
    if (result.valueType === "number") {
      result.value = event.value;
    } else if (result.valueType === "boolean") {
      result.value = JSON.parse(event.value);
    } else if (result.valueType === "string") {
      result.value = event.value;
    }

    if (result.valueType === "array") {
      // This happens for an empty array
      result.valueType = "string[]";
    }

    if (!forKeyNode) {
      this.parseComment(result, event.end_mark);
    }
    return result;
  }

  /**
   * Extract yaml data type.
   * @param tag The tag to extract data type
   * @returns extracted data type or empty if it is not a data type
   */
  private extractYamlDataType(tag: string) {
    const trimmed = _.trim(tag);
    // Extract the data type
    const extracted = trimmed.replace(/^tag:yaml.org,2002:/, "");

    // Return extracted data type
    return extracted || "";
  }

  /**
   * Convert yaml data type.
   * @param yamlType The yaml data type
   * @returns converted data type or empty if it is not a data type
   */
  private convertYamlDataType(yamlType: string) {
    // note if there is more data types need to map then add on mapping of types of YAML and JSON
    return this.typeMap[yamlType] ? this.typeMap[yamlType] : _.trim(yamlType);
  }

  /**
   * Parse comment, will take care root comment.
   * @param node The TreeNode to set comment
   * @param startMark The start mark
   */
  private parseComment(node: TreeNode, startMark: any) {
    if (this.root) {
      // Parse root comment
      let rootComments;
      for (let i = 0; i < startMark.line; i++) {
        const match = this.lines[i].match(/^(\s)*(#.*)/);
        if ((match && match[2]) || _.isEmpty(this.lines[i])) {
          // For root comment, keep it as is
          rootComments = rootComments || [];
          rootComments.push(this.lines[i]);
        }
      }
      node.comment = rootComments;

      this.root = false;
    } else {
      node.comment = this.parseYamlCommentLines(startMark);
    }
  }

  /**
   * Parse yaml comments from multiple lines.
   * @param startMark The start mark
   * @returns parsed comments or undefined if there is not any
   */
  private parseYamlCommentLines(startMark) {
    const comments = [];

    let lineNum = startMark.line;
    const startLine = this.lines[lineNum];
    const inlineComment = this.extractYamlComment(
      startLine.substring(startMark.column + 1)
    );
    if (_.isString(inlineComment)) {
      comments.push(inlineComment);
    }

    while (lineNum < this.lines.length - 1) {
      ++lineNum;
      if (_.isEmpty(_.trim(this.lines[lineNum]))) {
        continue;
      }
      const match = this.lines[lineNum].match(/^(\s)*(#.*)/);
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
   * Extract yaml comment.
   * @param comment The comment to extract
   * @returns extracted comment or undefined if it is not a comment
   */
  private extractYamlComment(comment: string) {
    const trimmed = _.trim(comment);
    const idx = _.indexOf(trimmed, "#");
    if (!trimmed || idx === -1) {
      // Does not contain '#', it's not a comment, return undefined
      return;
    }
    if (trimmed[idx + 1] === "#") {
      return _.trim(trimmed.substring(idx));
    }
    return _.trim(trimmed.substring(idx + 1));
  }
}

class YamlRender {
  // mapping of type from JSON to YAML
  private typeMapReverse = {
    string: "str",
    number: "float",
    object: "map",
    boolean: "bool",
    array: "seq"
  };

  /**
   * Convert TreeNode object to yaml format.
   * @param tree The TreeNode object
   * @returns Yaml format string
   */
  render(tree: TreeNode) {
    if (_.isEmpty(tree.children)) {
      return tree.isArray() ? "[]" : "{}";
    }

    let result = "";

    if (tree.comment) {
      // Add root comments
      _.each(tree.comment, comment => {
        if (/^(\s)*(#.*)/.test(comment) || _.isEmpty(comment)) {
          result += comment + "\n";
        }
      });
    }

    result += this.walkTreeNode(tree);
    result = _.trim(result);

    return result;
  }

  /**
   * Render yaml comment.
   * @param comment The comment to render
   * @returns the comment rendered
   */
  private renderYamlComment(comment: string) {
    if (!comment) {
      return "  #";
    }

    if (comment[0] === "#" && comment[1] === "#") {
      // For multiple consecutive '#', like: '###...'
      // return it as is
      return `  ${comment}`;
    }

    return `  # ${comment}`;
  }

  /**
   * Render comments.
   * @param comments Multiple lines of comments
   * @param result The render result
   * @param indent The indent spaces
   * @returns render result
   */
  private renderComments(comments: string[], result: string, indent: string) {
    result += this.renderYamlComment(comments[0]);

    for (let i = 1; i < comments.length; i++) {
      result += "\n" + indent + this.renderYamlComment(comments[i]);
    }
    return result;
  }

  /**
   * Walk TreeNode, convert to yaml format.
   * @param treeNode The TreeNode
   * @param indent The indent spaces
   * @returns Yaml format string
   */
  private walkTreeNode(treeNode: TreeNode, indent: string = "") {
    let result = "";

    _.each(treeNode.children, child => {
      if (treeNode.isArray()) {
        result += indent + "-";
      } else {
        result += indent + child.key + ":";
      }

      // Extract comment
      const comment = child.comment;
      const hasComment = child.comment && child.comment.length > 0;

      let type = child.valueType;

      const aliasOnly =
        child.aliases &&
        child.aliases.length &&
        (child.valueType !== PROPERTY_VALUE_TYPES.OBJECT ||
          (!child.anchor && (!child.children || !child.children.length)));

      if (aliasOnly) {
        result += ` *${child.aliases[0]}`;

        if (hasComment) {
          result = this.renderComments(comment, result, indent);
        }

        result += "\n";
        return;
      }

      if (child.isArray()) {
        result += " !!seq";
      } else {
        if (type === PROPERTY_VALUE_TYPES.NUMBER && _.isInteger(child.value)) {
          type = "int";
        } else {
          type = this.typeMapReverse[type];
        }
        result += " !!" + type;
      }

      if (child.anchor) {
        result += " &" + child.anchor;
      }

      if (!child.isLeaf()) {
        // Append inline comment and multiple lines comments
        if (hasComment) {
          result = this.renderComments(comment, result, indent);
        }

        if (child.aliases && child.valueType === PROPERTY_VALUE_TYPES.OBJECT) {
          child.aliases.forEach(alias => {
            result += "\n" + indent + "  <<: *" + alias;
          });
        }

        // Recursively walk the children nodes
        const nestResult = this.walkTreeNode(child, indent + "  ");
        result += "\n" + nestResult;
      } else {
        let value = child.value;

        // Append simple value and inline comment
        if (type === "str") {
          value = value.replace(/\\/g, "\\\\");
          value = value.replace(/\"/g, "\\\"");
          result += " \"" + value + "\"";
        } else if (value === Number.POSITIVE_INFINITY) {
          result += " .inf";
        } else if (value === Number.NEGATIVE_INFINITY) {
          result += " -.inf";
        } else if (Number.isNaN(value)) {
          result += " .nan";
        } else {
          result += " " + value;
        }

        if (hasComment) {
          result = this.renderComments(comment, result, indent);
        }

        result += "\n";
      }
    });

    return result;
  }
}

@Injectable({ providedIn: "root" })
export class YamlService {
  /**
   * Convert yaml to TreeNode object.
   * @param yaml The yaml string
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns TreeNode object
   */
  convertYamlToTree(yaml: string, simpleArray: boolean = true) {
    return new YamlParser().parse(yaml, simpleArray);
  }

  /**
   * Parse yaml to Configuration object.
   * @param yaml The yaml string
   * @param simpleArray The flag indicates whether only supports simple array
   * @returns Configuration object
   */
  parseYamlConfig(yaml: string, simpleArray: boolean = true) {
    return Configuration.fromTreeNode(
      this.convertYamlToTree(yaml, simpleArray)
    );
  }

  /**
   * Convert TreeNode object to yaml format.
   * @param tree The TreeNode object
   * @param validate Whether validate converted yaml string, defaults to true
   * @returns Yaml format string
   */
  convertTreeToYaml(tree: TreeNode, validate: boolean = true) {
    const result = new YamlRender().render(tree);

    if (validate) {
      try {
        // Validate against safe schema
        jsYaml.safeLoad(result, { schema: jsYaml.SAFE_SCHEMA });
      } catch (err) {
        throw err;
      }
    }

    return result;
  }

  /**
   * Escape reg exp.
   *
   * @param text the text might contain reg exp to escape
   * @returns escaped text
   */
  escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  /**
   * Create regexp for variable reference based on percy config.
   *
   * @returns regexp for variable reference
   */
  createRegExp() {
    const prefix = _.defaultTo(
      appPercyConfig.variablePrefix,
      percyConfig.variablePrefix
    );
    const suffix = _.defaultTo(
      appPercyConfig.variableSuffix,
      percyConfig.variableSuffix
    );
    const regexPattern = `${this.escapeRegExp(prefix)}(.+?)${this.escapeRegExp(
      suffix
    )}`;
    return new RegExp(regexPattern, "g");
  }

  /**
   * Construct variable reference.
   *
   * @param variable the variable name
   * @returns variable reference
   */
  constructVariable(variable: string) {
    const prefix = _.defaultTo(
      appPercyConfig.variablePrefix,
      percyConfig.variablePrefix
    );
    const suffix = _.defaultTo(
      appPercyConfig.variableSuffix,
      percyConfig.variableSuffix
    );
    return `${prefix}${variable}${suffix}`;
  }

  /**
   * When resolve token variable references, we collect them to detect loop reference.
   * @param referenceLinks the collected reference links
   * @param refFrom the reference from (left side)
   * @param refTo the reference to (right side)
   * @throws Error if loop reference detected
   */
  private addTokenReference(referenceLinks, refFrom, refTo): string[][] {
    const cycles = [];

    if (refFrom === refTo) {
      cycles.push([refFrom, refTo]);
      return cycles;
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
        cycles.push(cyclic);
      }
      referenceLink.push(refTo);
      added = true;
    });

    if (!added) {
      referenceLinks.push([refFrom, refTo]);
    }

    return cycles;
  }

  /**
   * Tokens (which are top level properties of default config) can also be variable and reference each other.
   * This method resolves them.
   *
   * @param tokens the tokens to resolves
   * @param env the environment name
   * @returns the resolved tokens
   */
  private resolveTokens(tokens, env: string, throwError = true) {
    const result = _.cloneDeep(tokens);
    const envVariableName = _.defaultTo(
      appPercyConfig.envVariableName,
      percyConfig.envVariableName
    );
    result[envVariableName] = env;

    const tokenCount = _.keys(result).length;

    const referenceLinks = [];
    let loopTokens = [];
    let allCycles = [];
    let tokenResolvedCount = 0;

    while (tokenCount !== (loopTokens.length + tokenResolvedCount)) {

      _.each(result, (value, key) => {
        if (typeof value !== "string") {
          return;
        }

        let retValue = value;

        const regExp = this.createRegExp();
        let regExpResult;

        while ((regExpResult = regExp.exec(value))) {
          const fullMatch = regExpResult[0];
          const tokenName = regExpResult[1];
          const tokenValue = result[tokenName];

          if (typeof tokenValue === "string") {
            if (this.createRegExp().exec(tokenValue)) {
              if (_.includes(loopTokens, tokenName)) {
                loopTokens.push(key);
              } else {
                const newCycles = this.addTokenReference(referenceLinks, key, tokenName);
                if (newCycles.length > 0) {
                  if (throwError) {
                    throw new Error("Cyclic variable reference: " + newCycles[0].join("->"));
                  }
                  allCycles = [ ...allCycles, ...newCycles ];
                  loopTokens = _.flatten(allCycles);
                }
              }
              continue;
            }
          }
          retValue = retValue.replace(fullMatch, tokenValue);
        }

        result[key] = retValue;
      });

      tokenResolvedCount = _.filter(result, value => !this.createRegExp().exec(value)).length;
      loopTokens = _.uniq(loopTokens);
    }

    _.each(loopTokens, token => {
      result[token] = _LOOP_;
    });

    return result;
  }

  /**
   * Yaml config can contain variable reference.
   * This method rescusively substitutes the variable references.
   *
   * @param target the config to substitute
   * @param tokens the tokens (which are top level properties of default config)
   * @param depth the depth of config
   * @returns the substitued config
   */
  private substitute(target: TreeNode, tokens, depth) {
    if (target.valueType === PROPERTY_VALUE_TYPES.OBJECT) {
      _.each(target.children, child => {
        if (depth === 0 && child.isLeaf() && _.has(tokens, child.key)) {
          child.value = tokens[child.key];
        } else {
          this.substitute(child, tokens, depth++);
        }
      });
      return target;
    }

    if (
      target.valueType === PROPERTY_VALUE_TYPES.STRING_ARRAY ||
      target.valueType === PROPERTY_VALUE_TYPES.OBJECT_ARRAY ||
      target.valueType === "array"
    ) {
      _.each(target.children, child => {
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
    while ((regExpResult = regExp.exec(text))) {
      const fullMatch = regExpResult[0];
      const tokenName = regExpResult[1];
      const tokenValue = tokens[tokenName];

      retVal = retVal.replace(fullMatch, tokenValue);
    }
    target.value = retVal;
    return target;
  }

  /**
   * Environment can inherit another environment.
   * This method merges environment.
   *
   * @param dest the dest environment to merge to
   * @param src the source environment to merge from
   */
  private mergeEnv(dest: TreeNode, src: TreeNode) {
    const match = src.findChild(dest.getPathsWithoutRoot());
    if (match) {
      dest.comment = match.comment || dest.comment;
      dest.aliases = match.aliases;
      dest.anchor = match.anchor;
    }
    if (dest.isLeaf()) {
      if (match) {
        dest.value = match.value;
      }
    } else if (dest.isArray()) {
      if (match) {
        // Copy array
        dest.children = [];
        const arr = _.cloneDeep(match.children);
        _.each(arr, item => {
          item.parent = null;
          dest.addChild(item);
        });
      }
    } else {
      _.each(dest.children, subChild => {
        this.mergeEnv(subChild, src);
      });
    }
  }

  /**
   * Compile yaml for given environment.
   * @param env the environment name
   * @param config the configuration object
   * @returns compiled yaml string
   */
  compileYAML(env: string, config: Configuration) {
    // Step 1, merge env inheritance with default config
    const mergeStack = [];
    const inheritedEnvs = [env];

    let envNode = config.environments.findChild([env]);
    while (envNode) {
      const deepCopy = _.cloneDeep(envNode);
      const inherits = deepCopy.findChild(["inherits"]);
      mergeStack.unshift(deepCopy);
      if (inherits) {
        _.remove(deepCopy.children, v => v === inherits);
        const inheritEnv = inherits.value;
        if (inheritedEnvs.indexOf(inheritEnv) > -1) {
          throw new Error("Cylic env inherits detected!");
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

    // Step 2, resolve tokens
    let tokens = {};
    _.each(merged.children, child => {
      if (child.isLeaf()) {
        tokens[child.key] = child.value;
      }
    });

    tokens = this.resolveTokens(tokens, env);

    // Step 3, substitute variable reference with tokens
    const substituted = this.substitute(merged, tokens, 0);
    substituted.key = env;

    // Step 4, merge anchor/alias
    const mergeAnchor = (node: TreeNode) => {
      _.each(node.children, child => {
        if (child.children) {
          mergeAnchor(child);
        }
        if (child.isObjectInArray() && child.aliases && child.aliases.length) {
          const anchorNode = _.cloneDeep(
            config.default.findAnchorNode(child.aliases[0])
          );
          if (anchorNode) {
            const childKeys = _.map(child.children, c => c.key);
            const anchorChildren = _.filter(
              anchorNode.children,
              c => childKeys.indexOf(c.key) < 0
            );
            _.each(anchorChildren, item => {
              item.parent = null;
              child.addChild(item);
            });
            child.aliases = null; // We've merged anchor/alias, don't need show alias in compiled view
          }
        }
      });
    };
    mergeAnchor(substituted);

    // Step 5, omit variable
    const variableNamePrefix = _.defaultTo(
      appPercyConfig.variableNamePrefix,
      percyConfig.variableNamePrefix
    );
    if (variableNamePrefix) {
      substituted.children = _.filter(substituted.children, c => {
        return !c.isLeaf() || !c.key.startsWith(variableNamePrefix);
      });
    }

    return this.convertTreeToYaml(substituted, false);
  }

  /**
   * gets variables config, like cascaded value and reference node for all environments including default
   * @param config the configuration object
   */
  getEnvsVariablesConfig(config: Configuration): EnvsVariablesConfig {
    const allEnvsVariablesConfig = {};
    const defaultTree = _.cloneDeep(config.default);

    const possibleVariables = _.reduce(defaultTree.children, (accu, child) => {
      return child.isLeaf() ? accu.concat(child.key) : accu;
    }, []);

    _.each([ ...config.environments.children, defaultTree ], envNode => {
      const envKey = envNode.key;
      const mergeStack = [];
      const inheritedEnvs = [envKey];
      let hasCyclicError = false;

      while (envNode) {
        const deepCopy = _.cloneDeep(envNode);
        const inherits = deepCopy.findChild(["inherits"]);
        mergeStack.push(deepCopy);
        if (inherits) {
          _.remove(deepCopy.children, v => v === inherits);
          const inheritEnv = inherits.value;
          if (inheritedEnvs.indexOf(inheritEnv) > -1) {
            hasCyclicError = true;
            break;
          }
          inheritedEnvs.push(inheritEnv);
          envNode = config.environments.findChild([inheritEnv]);
        } else {
          break;
        }
      }

      const variablesConfig = {};
      let variablesCascadedValues = {};

      if (!hasCyclicError) {
        // resolve variables cascaded values
        const merged = _.cloneDeep(config.default);
        _.forEachRight(mergeStack, m => {
          this.mergeEnv(merged, m);
        });

        _.each(merged.children, child => {
          if (child.isLeaf()) {
            variablesCascadedValues[child.key] = child.value;
          }
        });

        variablesCascadedValues = this.resolveTokens(variablesCascadedValues, envKey, false);

        // get reference nodes
        mergeStack.push(defaultTree);
        _.each(possibleVariables, variable => {
          let referenceNode;
          _.every(mergeStack, stack => {
            if (referenceNode) {
              return false;
            }

            _.every(stack.children, node => {
              if (node.key === variable) {
                referenceNode = node;
                return false;
              }
              return true;
            });

            return true;
          });

          const cascadedValue = variablesCascadedValues[variable];

          variablesConfig[variable] = {
            cascadedValue: cascadedValue === _LOOP_ ? "Cyclic variable reference found!" : cascadedValue,
            hasError: cascadedValue === _LOOP_,
            referenceNode
          };
        });
      } else {
        _.each(possibleVariables, variable => {
          variablesConfig[variable] = {
            cascadedValue: "Cylic env inherits detected!",
            hasError: true
          };
        });
      }

      // add the env variable value
      const envVariableName = _.defaultTo(
        appPercyConfig.envVariableName,
        percyConfig.envVariableName
      );
      variablesConfig[envVariableName] = {
        cascadedValue: envKey
      };

      allEnvsVariablesConfig[envKey] = variablesConfig;
    });

    return allEnvsVariablesConfig;
  }

  /**
   * Highlight variable within yaml text string value
   * @param text the yaml text string value
   * @param parentSpan the parent span node contains the text
   * @returns span element with variable highlighted, or given parent span if there is no variable found
   */
  highlightVariable(text: string, parentSpan?: Cheerio) {
    const prefix = _.defaultTo(
      appPercyConfig.variablePrefix,
      percyConfig.variablePrefix
    );

    // Find out the variable token, wrap it in '<span class="yaml-var">${tokenName}</span>'
    let leftIdx = 0;
    let regExpResult;
    let newSpan: Cheerio = null;
    const $ = cheerio.load("");
    const regExp = this.createRegExp();
    while ((regExpResult = regExp.exec(text))) {
      if (!newSpan) {
        newSpan = $("<span class=\"hljs-string\"></span>");
      }
      const tokenName = regExpResult[1];

      // Append left side plus variable substitute prefix
      newSpan.append(
        $("<span></span>").text(
          text.slice(leftIdx, regExpResult.index) + prefix
        )
      );
      // Append variable token name
      newSpan.append($("<span class=\"yaml-var\"></span>").text(tokenName));
      // Update index
      leftIdx = regExpResult.index + prefix.length + tokenName.length;
    }

    if (newSpan) {
      // Append string left
      newSpan.append($("<span></span>").text(text.slice(leftIdx)));
      return newSpan;
    }
    return parentSpan ? parentSpan : $("<span></span>").text(text);
  }

  /**
   * Highlight variable within yaml text string value in a TreeNode
   * @param node the string TreeNode to highlight its value
   * @returns html rendered with highlighted variable
   */
  highlightNodeVariable(node: TreeNode) {
    if (node.valueType !== PROPERTY_VALUE_TYPES.STRING) {
      return node.value;
    }
    const span = this.highlightVariable(_.defaultTo(node.value, ""));
    return span.html();
  }

  /**
   * parse string type node values for variables and return value as a config which can then be rendered
   * @param node the string TreeNode to highlight its value
   * @param envsVariablesConfig  pre calculated variable config for each environment
   */
  getNodeValueConfig(node: TreeNode, envsVariablesConfig: EnvsVariablesConfig): ValueConfig[] {
    const span = this.highlightVariable(_.defaultTo(node.value, ""));
    const $ = cheerio.load(span.html());

    // if there are no variables at all in the node value
    if ($("span").length === 0) {
      return [{ text: span.html() }];
    }

    const nodePaths = node.getPaths();
    const nodeEnv = nodePaths[0] === "default" ? "default" : nodePaths[1];

    const valueConfig = [];
    $("span").each(function() {
      const config = { text: $(this).text() };

      // if its a variable
      if ($(this).hasClass("yaml-var")) {
        const notFoundConfig: VariableConfig = {
          cascadedValue: "Undefined variable!",
          hasError: true
        };

        const variableConfig = _.get(envsVariablesConfig, `${nodeEnv}.${config.text}`, notFoundConfig);
        config["variableConfig"] = variableConfig;
      }

      valueConfig.push(config);
    });

    return valueConfig;
  }

  /**
   * Get tooltip for app's specific percy config.
   * @param appConfig app's specific percy config
   * @returns tooltip for app's specific percy config
   */
  getAppConfigTooltip(appConfig) {
    const defaultAppConfig = _.pick(percyConfig, [
      "variablePrefix",
      "variableSuffix",
      "variableNamePrefix",
      "envVariableName"
    ]);
    const overridden = _.assign(defaultAppConfig, appConfig);
    return _.reduce(
      overridden,
      (_result, value, key) => _result + key + ": " + value + "\n",
      ""
    );
  }
}
