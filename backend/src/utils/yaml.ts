/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This module contains the methods to convert between yaml and json.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as boom from 'boom';
import * as jsYaml from 'js-yaml';
import * as _ from 'lodash';
import * as yamlJS from 'yaml-js';

import * as helper from './helper';

// mapping of type from YAML to JSON
const typeMap = {
  str: 'string',
  int: 'number',
  float: 'number',
  map: 'object',
  seq: 'array',
  bool: 'boolean',
  null: 'string',
};

// mapping of type from JSON to YAML
const typeMapReverse = {
  string: 'str',
  number: 'float',
  object: 'map',
  boolean: 'bool',
  array: 'seq',
};

/**
 * Extract yaml comment.
 * @param comment The comment to extract
 * @returns extracted comment or undefined if it is not a comment
 * @private
 */
function extractYamlComment(comment: string) {
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
function extractYamlDataType(dataType: string) {
  const trimmed = _.trim(dataType);
  // Extract the data type
  const extracted = trimmed.replace(/^tag:yaml.org,2002:/, '');

  // Return extracted data type
  // note if there is more data types need to map then add on mapping of types of YAML and JSON
  return typeMap[extracted] ? typeMap[extracted] : _.trim(extracted);
}

/**
 * Parse yaml comments from multiple lines.
 * @param startMark The start mark
 * @param lines The split lines of yaml file
 * @returns parsed comments or undefined if there is not any
 * @private
 */
function parseYamlCommentLines(startMark, lines: string[]) {

  const comments = [];

  let lineNum = startMark.line;
  const startLine = lines[lineNum];
  const inlineComment = extractYamlComment(startLine.substring(startMark.column + 1));
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
      const lineComment = extractYamlComment(match[2]);
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
function setComment(obj, comment: string[]) {
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
function setDataType(obj, type: string) {
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
function walkYamlTree(yamlNode, lines: string[]) {
  if (yamlNode.id === 'mapping') {
    // Mapping node, represents an object
    const result = {};

    _.each(yamlNode.value, ([keyNode, valueNode]) => {

      // Recursively walk the value node
      const nestResult = walkYamlTree(valueNode, lines);

      let comment;
      let type;
      if (valueNode.id !== 'scalar') {
        // This will parse inline comment and after multiple lines comments like:
        // key:  # some inline comment...
        //   # multiple line 1
        //   # multiple line 2
        comment = parseYamlCommentLines(keyNode.end_mark, lines);
        type = extractYamlDataType(valueNode.tag);
      }
      result[keyNode.value] = setDataType(setComment(nestResult, comment), type);
    });

    return result;
  } else if (yamlNode.id === 'sequence') {
    // Sequence node, represents an array
    let result = [];

    _.each(yamlNode.value, (node, idx) => {
      const type = extractYamlDataType(node.tag);
      result[idx] = setDataType(walkYamlTree(node, lines), type);
    });

    if (yamlNode.value.length) {
      const comment = parseYamlCommentLines(yamlNode.start_mark, lines);
      result = setComment(result, comment);
    }

    return result;
  } else {
    // Scalar node, represents a string/number..

    // This will parse inline comment like:
    // key: value  # some inline comment...
    // const line = lines[yamlNode.end_mark.line];
    // extractYamlComment(line.substring(yamlNode.end_mark.column));
    const comment = parseYamlCommentLines(yamlNode.end_mark, lines);

    // Parse number if possible
    let value = yamlNode.value;
    const type = extractYamlDataType(yamlNode.tag);
    if (type === 'number') {
      value = _.toNumber(value);
    }

    if (type === 'boolean') {
      value = JSON.parse(value);
    }

    return setDataType(setComment(value, comment), type);
  }
}

/**
 * Convert yaml to json object.
 * @param yaml The yaml string
 * @returns json object
 */
export function convertYamlToJson(yaml: string) {
  const yamlNode = yamlJS.compose(yaml);
  const lines = yaml.split(/\r?\n/);

  // Walk yaml tree
  const result = !yamlNode ? null : walkYamlTree(yamlNode, lines);

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

  return setComment(result, rootComments);
}

/**
 * Render yaml comment.
 * @param comment The comment to render
 * @returns the comment rendered
 * @private
 */
function renderYamlComment(comment: string) {
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
 * @private
 */
function walkJsonTree(jsonNode, indent: string = '') {

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
      result = walkJsonTree(value, indent);
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
      type = typeMapReverse[type];
    }
    if (type) {
      if (!isArray || type !== 'map') {
        result += ' !!' + type;
      }
    }

    if (_.isObject(value)) {
      // Append inline comment and multiple lines comments
      if (hasComment) {
        result += renderYamlComment(comment[0]);

        for (let i = 1; i < comment.length; i++) {
          result += '\n' + indent + renderYamlComment(comment[i]);
        }
      }
      // Recursively walk the value node
      const nestResult = walkJsonTree(value, indent + '  ');
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
        result += renderYamlComment(comment[0]);

        for (let i = 1; i < comment.length; i++) {
          result += '\n' + indent + renderYamlComment(comment[i]);
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
export function convertJsonToYaml(json) {
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

  result += walkJsonTree(json);

  try {
    // Validate against safe schema
    jsYaml.safeLoad(result, { strict: true });
  } catch (err) {
    helper.logFullError(err, 'convertJsonToYaml');
    throw boom.badRequest(`Yaml safe schema validation failed: ${err.message}`);
  }

  return result;
}
