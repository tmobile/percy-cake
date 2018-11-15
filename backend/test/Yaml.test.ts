/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines tests for yaml.
 *
 * @author TCSCODER
 * @version 1.0
 */

import * as path from 'path';

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as yamlJS from 'yaml-js';

import * as Yaml from '../src/utils/yaml';

describe('Yaml Tests', () => {

  const sampleJson = fs.readJsonSync(path.resolve(__dirname, '../../test/sample.json'));
  const sampleYaml = fs.readFileSync(path.resolve(__dirname, '../../test/sample.yaml')).toString();

  const sample2Json = fs.readJsonSync(path.resolve(__dirname, '../../test/sample2.json'));
  const sample2Yaml = fs.readFileSync(path.resolve(__dirname, '../../test/sample2.yaml')).toString();

  it('Convert json to yaml', () => {
    const yaml = Yaml.convertJsonToYaml(sampleJson);
    console.log(yaml); // tslint:disable-line
    assert.deepEqual(yamlJS.load(yaml), yamlJS.load(sampleYaml));
  });

  it('Convert json to yaml 2', () => {
    const yaml = Yaml.convertJsonToYaml(sample2Json);
    console.log(yaml); // tslint:disable-line
    assert.deepEqual(yamlJS.load(yaml), yamlJS.load(sample2Yaml));
  });

  it('Convert json to yaml, root comments should be rendered properly', () => {
    const yaml = Yaml.convertJsonToYaml({
      $comment: ['##comment1', '#comment2', '', 'No #', '# comment3', '##comment4'],
      $value: { a: 1 },
    });
    assert.equal(yaml.trim(), '##comment1\n#comment2\n\n# No #\n# comment3\n##comment4\na: 1');
  });

  it('Convert json to yaml, null/undefined comment should success', () => {
    const yaml = Yaml.convertJsonToYaml({
      a: {
        $comment: [null],
        $value: 1,
      },
      b: {
        $comment: undefined,
        $value: 2,
      },
    });
    assert.equal(yaml.trim(), 'a: 1  #\nb: 2');
  });

  it('Convert json to yaml, empty object should be rendered properly', () => {
    let yaml = Yaml.convertJsonToYaml({});
    assert.equal(yaml, '{}');
    yaml = Yaml.convertJsonToYaml([]);
    assert.equal(yaml, '[]');
  });

  it('Convert json to yaml, null/undefined key should success', async () => {
    const yaml = Yaml.convertJsonToYaml({ null: '', undefined: '' });

    assert.equal(yaml.trim(), 'null: \nundefined:');
  });

  it('Convert json to yaml, null/undefined value should success', () => {
    const yaml = Yaml.convertJsonToYaml({
      a: [null, undefined],
      c: null,
      d: undefined,
    });
    assert.equal(yaml.trim(), 'a:\n  -\n  -\nc:\nd:');
  });

  it('Json does not follow yaml schema, error expected', async () => {
    try {
      Yaml.convertJsonToYaml({ a: '-' });
      assert.fail('Json does not follow yaml schema, error expected');
    } catch (err) {
      assert.isTrue(err.message.startsWith('Yaml safe schema validation failed'));
    }
  });

  it('Convert yaml to json', () => {
    const json = Yaml.convertYamlToJson(sampleYaml);
    assert.deepEqual(json, sampleJson);
  });

  it('Convert yaml to json 2', () => {
    const json = Yaml.convertYamlToJson(sample2Yaml);
    assert.deepEqual(json, sample2Json);
  });

  it('Convert empty yaml to json', () => {
    const json = Yaml.convertYamlToJson('');
    assert.isNull(json);
  });

  it('Convert simple yaml "[]" to json, should success', () => {
    const json = Yaml.convertYamlToJson('[]');
    assert.deepEqual(json, []);
  });

  it('Convert simple yaml "{}" to json, should success', () => {
    const json = Yaml.convertYamlToJson('{}');
    assert.deepEqual(json, {});
  });

  it('Convert yaml to json, null/undefined key should success', () => {
    const json = Yaml.convertYamlToJson('null: \nundefined:');
    assert.deepEqual(json, {
      null: {
        $type: 'string',
        $value: '',
      },
      undefined: {
        $type: 'string',
        $value: '',
      },
    });
  });

  it('Convert yaml to json, null/undefined value should success', () => {
    const json = Yaml.convertYamlToJson('null: null\nundefined: undefined');
    assert.deepEqual(json, {
      null: {
        $type: 'string',
        $value: 'null',
      },
      undefined: {
        $type: 'string',
        $value: 'undefined',
      },
    });
  });

  it('Convert yaml to json, root comments should be rendered properly', () => {
    const json = Yaml.convertYamlToJson('# comment1\n\n\n\n# comment2\n  b: c');
    assert.deepEqual(json, {
      $comment: ['# comment1', '', '', '', '# comment2'],
      b: {
        $type: 'string',
        $value: 'c',
      },
    });
  });

  it('Convert yaml contains empty lines between comments, should success', () => {
    const json = Yaml.convertYamlToJson('a:\n# comment1\n\n\n\n# comment2\n  b: c');
    assert.deepEqual(json, {
      a: {
        $comment: ['comment1', 'comment2'],
        $type: 'object',
        b: {
          $type: 'string',
          $value: 'c',
        },
      },
    });
  });

});
