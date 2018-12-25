import * as cheerio from 'cheerio';

import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { PROPERTY_VALUE_TYPES, percyConfig } from 'config';
import { TestUser, utilService } from 'test/test-helper';

import { git } from './util.service';

const constructVar = utilService.constructVariable;

describe('UtilService', () => {

  it('should initialize git and browser fs', async () => {
    const fs = await utilService.getBrowserFS();

    expect(git.version()).toBeDefined();

    expect(await fs.pathExists(percyConfig.reposFolder)).toBeTruthy();

    expect(await fs.pathExists(percyConfig.metaFolder)).toBeTruthy();

    expect(await fs.pathExists(percyConfig.draftFolder)).toBeTruthy();
  });

  const sampleYaml =
    `###
# Sample yaml.
#
# @author TCSCODER
# @version 1.0
# @copyright Copyright (c) 2018 TopCoder, Inc. All rights reserved.
###

default: !!map  # all known properties are defined in the default block.
  # The most common values are assigned in the default block
  appVer: !!str "0.1.0"  # appVer comment line1
    # appVer comment line2
  host: !!str "www.mobilex.com"  # The url domain for the deployed environment
  dataService: !!str "pd01.mobilex.com/data"  # url to access JSON Web API
  myProp: !!bool true  # myProp comment line1
    # myProp comment line2
    #
environments: !!map  # specific environments can override the default values 1 property at a time
  qat: !!map  # qat team validates all compiled artifacts in separate test environment with their own data service.
    qat-items: !!seq  # array of maps
      - !!map  # map in array comment
        # map in array comment line2
        item1A: !!int 8800
        item1B: !!float -12.3
      - !!map
        item2A: !!str "value2A"  #### value2A comment #####
        item2B: !!str "value2B"  # value2B comment
    host: !!str "{{api.host}}.mobilex.com"
    dataService: !!str "pd03.mobilex.com/data"  # 'qat dataService'
  local: !!map  # local comment line1
    # local comment line2
    host: !!str "localhost"
  dev: !!map  # environment for developer testing of fully compiled and integrated application
    host: !!str "dev.mobilex.com"
    dev-items: !!seq  # dev-items comments
      - !!seq  # nest array comments
        - !!str "\\\\aa\\\\\\"bb\\\\\\"cc"  # nest item1 comment
        - !!str "nest item2 \\\\ "  # nest item2 comment
      - !!str "dev-item2"
      - !!float -12.3
  staging: !!map
    staging-items1: !!seq  # items comment line1
      # items comment line2
      # items comment line3
      - !!str "item1"  # item1 comment
      - !!str "item2"  # item2 comment
      - !!str "item3"
    staging-items2: !!seq
      - !!int 12  # item1 comment
      - !!int 11  # item2 comment
      - !!int 33
    staging-items3: !!seq
      - !!bool true  # item1 comment
      - !!bool false  # item2 comment
      - !!bool true
    host: !!str "staging.mobilex.com"  # host comment line1
      # host comment line2`;

  it('should convert between Yaml and TreeNode', () => {

    const tree = utilService.convertYamlToTree(sampleYaml, false);

    const yaml2 = utilService.convertTreeToYaml(tree);

    expect(yaml2).toEqual(sampleYaml);
  });

  it('should parse and render anchor and aliase', () => {

    const anchorYaml = `
foo: !!map
  <<: !!map &anchor1  # anchor1 comment
    K1: !!str "One"
  <<: !!map &anchor2  # anchor2 comment
    K2: !!str "Two"
  K3: !!str &scalaAnchor "Three"
  arr: !!seq &arrAnchor
    - !!str &itemAnchor "item1"  # item comment line1
      # item comment line2
    - !!str "item2"
  obj: !!map &anchor3
    <<: *anchor1
bar: !!map &anchor4
  K4: !!str "Four"
  K5: !!str "Five"
joe: !!map  # comment line1
  # comment line2
  <<: *anchor1
  <<: *anchor2
  <<: *anchor3
  K3: *scalaAnchor
  K4: !!str "I Changed"
  arr: !!seq
    - *itemAnchor  # alias item comment line1
      # alias item comment line2
  arr2: *arrAnchor  # alias comment line1
    # alias comment line2
  oarr: !!seq
    - !!map  # map in array comment line1
      # map in array comment line2
      <<: *anchor2
    - !!map  # map in array comment line1
      # map in array comment line2
      <<: *anchor3
    - !!map  # map in array comment line1
      # map in array comment line2
      <<: *anchor4
`;

    const tree = utilService.convertYamlToTree(anchorYaml, false);

    const yaml2 = utilService.convertTreeToYaml(tree);

    expect(yaml2).toEqual(anchorYaml.trim());

    expect(tree.findChild(['foo', 'obj']).getAliasOptions(tree)).toEqual(['anchor1', 'anchor2']);
    expect(tree.findChild(['joe', 'oarr', '[0]']).getAliasOptions(tree)).toEqual(['anchor1', 'anchor2', 'anchor3', 'anchor4']);
  });

  it('duplicate anchor should fail', () => {

    const anchorYaml = `
foo: !!map &anchor1
  <<: !!map &anchor1
`;
    try {
      utilService.convertYamlToTree(anchorYaml, false);
      fail('duplicate anchor should fail');
    } catch (err) {
      expect(err.message).toEqual('Found duplicate anchor: anchor1');
    }
  });

  it('undefined anchor should fail', () => {

    const anchorYaml = `
foo: !!map
  <<: *NoSuchAnchor
`;
    try {
      utilService.convertYamlToTree(anchorYaml, false);
      fail('undefined anchor should fail');
    } catch (err) {
      expect(err.message).toEqual('Found undefined anchor: NoSuchAnchor');
    }
  });

  it('simple value type should be converted', () => {

    const yaml = 'host: !!str "staging.mobilex.com"  # host comment line1';
    const tree = utilService.convertYamlToTree(yaml);
    let yaml2 = utilService.convertTreeToYaml(tree);
    expect(yaml2).toEqual(yaml);

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'value', ['comment1', 'comment2']));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.BOOLEAN, true, ['comment1', 'comment2']));
    config.default.addChild(new TreeNode('key3', PROPERTY_VALUE_TYPES.NUMBER, 10, ['comment1', 'comment2']));

    yaml2 = utilService.convertTreeToYaml(config);
    const config2 = utilService.parseYamlConfig(yaml2, true);

    expect(config2).toEqual(config);
  });

  it('empty array with comment should be converted', () => {

    const config = new Configuration();
    config.default.addChild(new TreeNode('array', PROPERTY_VALUE_TYPES.STRING_ARRAY, undefined, ['comment1', 'comment2']));
    config.environments.addChild(new TreeNode('dev'));
    config.environments.addChild(new TreeNode('qat'));

    const yaml = utilService.convertTreeToYaml(config);
    const config2 = utilService.parseYamlConfig(yaml, true);

    expect(config2).toEqual(config);
  });

  it('empty TreeNode should be converted', () => {

    const emptyObj = new TreeNode('', PROPERTY_VALUE_TYPES.OBJECT);
    expect(utilService.convertTreeToYaml(emptyObj)).toEqual('{}');

    const emptyArray = new TreeNode('', PROPERTY_VALUE_TYPES.STRING_ARRAY);
    expect(utilService.convertTreeToYaml(emptyArray)).toEqual('[]');
  });

  it('array with same simple type should be supported', () => {

    const tree: TreeNode = utilService.convertYamlToTree(sampleYaml, true);

    expect(tree.findChild(['environments', 'staging', 'staging-items1']).children.length).toEqual(3);
    expect(tree.findChild(['environments', 'staging', 'staging-items2']).children.length).toEqual(3);
    expect(tree.findChild(['environments', 'staging', 'staging-items3']).children.length).toEqual(3);
  });

  it('should ignore array item which is not same type', () => {

    const tree: TreeNode = utilService.convertYamlToTree(sampleYaml, true);

    expect(tree.findChild(['environments', 'dev', 'dev-items']).children.length).toEqual(1);
  });

  it('error expected when tree contains invalid yaml content', () => {
    const tree = new TreeNode('');

    tree.addChild(new TreeNode('@invalidkey', PROPERTY_VALUE_TYPES.STRING, 'value'));
    try {
      utilService.convertTreeToYaml(tree);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('@invalidkey') > -1).toBeTruthy();
    }
  });

  it('error expected when compile yaml with loop inherits', () => {
    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'value', ['comment1']));
    config.environments.addChild(new TreeNode('dev'));
    config.environments.addChild(new TreeNode('qat'));
    config.environments.addChild(new TreeNode('prod'));
    config.environments.findChild(['qat']).addChild(new TreeNode('inherits', PROPERTY_VALUE_TYPES.STRING, 'dev'));
    config.environments.findChild(['dev']).addChild(new TreeNode('inherits', PROPERTY_VALUE_TYPES.STRING, 'prod'));
    config.environments.findChild(['prod']).addChild(new TreeNode('inherits', PROPERTY_VALUE_TYPES.STRING, 'dev'));

    try {
      utilService.compileYAML('qat', config);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('Cylic env inherits detected') > -1).toBeTruthy();
    }

    config.environments.findChild(['qat', 'inherits']).value = 'qat';
    try {
      utilService.compileYAML('qat', config);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('Cylic env inherits detected') > -1).toBeTruthy();
    }
  });

  it('error expected when compile yaml with loop variable reference', () => {
    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'value', ['comment1']));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.NUMBER, 10, ['comment2']));
    config.default.addChild(new TreeNode('key3', PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.default.addChild(new TreeNode('var3', PROPERTY_VALUE_TYPES.STRING,
      `${constructVar('var1')}/${constructVar('var2')}/${constructVar('key3')}`));
    config.default.addChild(new TreeNode('var2', PROPERTY_VALUE_TYPES.STRING, `${constructVar('var1')}/${constructVar('key2')}`));
    config.default.addChild(new TreeNode('var1', PROPERTY_VALUE_TYPES.STRING, constructVar('var3')));

    config.environments.addChild(new TreeNode('dev'));
    try {
      console.log(utilService.compileYAML('dev', config));
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('Loop variable reference') > -1).toBeTruthy();
    }

    config.default.findChild(['var1']).value = constructVar('var1');
    try {
      utilService.compileYAML('dev', config);
      fail('error expected');
    } catch (err) {
      expect(err.message.indexOf('Loop variable reference') > -1).toBeTruthy();
    }
  });

  it('should compile yaml', () => {
    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'value', ['comment1']));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.NUMBER, 10, ['comment2']));
    config.default.addChild(new TreeNode('key3', PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.default.addChild(new TreeNode('var3', PROPERTY_VALUE_TYPES.STRING,
      `${constructVar('var1')}/${constructVar('var2')}/${constructVar('key3')}`));
    config.default.addChild(new TreeNode('var2', PROPERTY_VALUE_TYPES.STRING, `${constructVar('var1')}/${constructVar('key2')}`));
    config.default.addChild(new TreeNode('var1', PROPERTY_VALUE_TYPES.STRING, constructVar('key1')));

    config.default.addChild(new TreeNode('arr1', PROPERTY_VALUE_TYPES.STRING_ARRAY, null, ['arr1-comment']));
    config.default.findChild(['arr1']).addChild(new TreeNode('[0]', PROPERTY_VALUE_TYPES.STRING, 'value1'));
    config.default.findChild(['arr1']).addChild(new TreeNode('[1]', PROPERTY_VALUE_TYPES.STRING, 'value2'));

    config.default.addChild(new TreeNode('arr2', PROPERTY_VALUE_TYPES.NUMBER_ARRAY, null, ['arr2-comment']));
    config.default.findChild(['arr2']).addChild(new TreeNode('[0]', PROPERTY_VALUE_TYPES.NUMBER, 100));
    config.default.findChild(['arr2']).addChild(new TreeNode('[1]', PROPERTY_VALUE_TYPES.NUMBER, 200));

    config.default.addChild(new TreeNode('arr3', PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY, null, ['arr3-comment']));
    config.default.findChild(['arr3']).addChild(new TreeNode('[0]', PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.default.findChild(['arr3']).addChild(new TreeNode('[1]', PROPERTY_VALUE_TYPES.BOOLEAN, false));

    config.default.addChild(new TreeNode('obj', PROPERTY_VALUE_TYPES.OBJECT, null, ['obj-comment']));
    config.default.findChild(['obj']).addChild(new TreeNode('subkey', PROPERTY_VALUE_TYPES.STRING, constructVar('key1')));

    config.environments.addChild(new TreeNode('dev'));
    config.environments.addChild(new TreeNode('qat'));
    config.environments.addChild(new TreeNode('prod'));

    config.environments.findChild(['dev']).addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'dev-value'));
    config.environments.findChild(['dev']).addChild(new TreeNode('arr1', PROPERTY_VALUE_TYPES.STRING_ARRAY, null, ['dev-arr1-comment']));
    config.environments.findChild(['dev', 'arr1']).addChild(
      new TreeNode('[0]', PROPERTY_VALUE_TYPES.STRING, 'dev-item1-value', ['dev-item1-comment']));

    config.environments.findChild(['qat']).addChild(new TreeNode('inherits', PROPERTY_VALUE_TYPES.STRING, 'dev'));
    config.environments.findChild(['qat']).addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.NUMBER, 50, ['qat-comment2']));
    config.environments.findChild(['qat']).addChild(new TreeNode('arr2', PROPERTY_VALUE_TYPES.NUMBER_ARRAY, null, ['dev-arr2-comment']));
    config.environments.findChild(['qat', 'arr2']).addChild(new TreeNode('[0]', PROPERTY_VALUE_TYPES.NUMBER, 1000, ['qat-item1-comment']));
    config.environments.findChild(['qat', 'arr2']).addChild(new TreeNode('[1]', PROPERTY_VALUE_TYPES.NUMBER, 2000, ['qat-item2-comment']));
    config.environments.findChild(['qat', 'arr2']).addChild(new TreeNode('[2]', PROPERTY_VALUE_TYPES.NUMBER, 3000, ['qat-item3-comment']));

    config.environments.findChild(['prod']).addChild(new TreeNode('inherits', PROPERTY_VALUE_TYPES.STRING, 'qat'));
    config.environments.findChild(['prod']).addChild(new TreeNode('key3', PROPERTY_VALUE_TYPES.BOOLEAN, false));
    config.environments.findChild(['prod']).addChild(new TreeNode('arr3', PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY));
    config.environments.findChild(['prod', 'arr3']).addChild(
      new TreeNode('[0]', PROPERTY_VALUE_TYPES.BOOLEAN, false, ['prod-item1-comment']));
    config.environments.findChild(['prod', 'arr3']).addChild(
      new TreeNode('[1]', PROPERTY_VALUE_TYPES.BOOLEAN, true, ['prod-item2-comment']));
    config.environments.findChild(['prod']).addChild(
      new TreeNode('obj', PROPERTY_VALUE_TYPES.OBJECT, null, ['prod-obj-comment']));
    config.environments.findChild(['prod', 'obj']).addChild(
      new TreeNode('subkey', PROPERTY_VALUE_TYPES.STRING, `${constructVar('key1')}/${constructVar('key3')}`));

    expect(utilService.compileYAML('dev', config)).toEqual(
      `key1: !!str "dev-value"  # comment1
key2: !!int 10  # comment2
key3: !!bool true
var3: !!str "dev-value/dev-value/10/true"
var2: !!str "dev-value/10"
var1: !!str "dev-value"
arr1: !!seq  # dev-arr1-comment
  - !!str "dev-item1-value"  # dev-item1-comment
arr2: !!seq  # arr2-comment
  - !!int 100
  - !!int 200
arr3: !!seq  # arr3-comment
  - !!bool true
  - !!bool false
obj: !!map  # obj-comment
  subkey: !!str "dev-value"`);

    expect(utilService.compileYAML('qat', config)).toEqual(
      `key1: !!str "dev-value"  # comment1
key2: !!int 50  # qat-comment2
key3: !!bool true
var3: !!str "dev-value/dev-value/50/true"
var2: !!str "dev-value/50"
var1: !!str "dev-value"
arr1: !!seq  # dev-arr1-comment
  - !!str "dev-item1-value"  # dev-item1-comment
arr2: !!seq  # dev-arr2-comment
  - !!int 1000  # qat-item1-comment
  - !!int 2000  # qat-item2-comment
  - !!int 3000  # qat-item3-comment
arr3: !!seq  # arr3-comment
  - !!bool true
  - !!bool false
obj: !!map  # obj-comment
  subkey: !!str "dev-value"`);

    expect(utilService.compileYAML('prod', config)).toEqual(
      `key1: !!str "dev-value"  # comment1
key2: !!int 50  # qat-comment2
key3: !!bool false
var3: !!str "dev-value/dev-value/50/false"
var2: !!str "dev-value/50"
var1: !!str "dev-value"
arr1: !!seq  # dev-arr1-comment
  - !!str "dev-item1-value"  # dev-item1-comment
arr2: !!seq  # dev-arr2-comment
  - !!int 1000  # qat-item1-comment
  - !!int 2000  # qat-item2-comment
  - !!int 3000  # qat-item3-comment
arr3: !!seq  # arr3-comment
  - !!bool false  # prod-item1-comment
  - !!bool true  # prod-item2-comment
obj: !!map  # obj-comment
  subkey: !!str "dev-value/false"`);
  });

  it('should encrypt/decrypt', () => {
    const obj = {
      key: 'value',
      valid: true,
      time: Date.now()
    };
    const encrypted = utilService.encrypt(JSON.stringify(obj));

    const decrypted = JSON.parse(utilService.decrypt(encrypted));

    expect(decrypted).toEqual(obj);
  });

  it('should convert git error', () => {
    const err: any = new Error();
    err.data = { statusCode: 401 };
    expect(utilService.convertGitError(err).statusCode).toEqual(401);

    err.data = { statusCode: 403 };
    expect(utilService.convertGitError(err).statusCode).toEqual(403);

    err.data = { statusCode: 404 };
    expect(utilService.convertGitError(err).statusCode).toEqual(404);

    err.data = { statusCode: 500 };
    expect(utilService.convertGitError(err).statusCode).toEqual(500);
  });

  it('should get metadata file path', () => {
    expect(utilService.getMetadataPath('folderName')).toEqual(`${percyConfig.metaFolder}/folderName.meta`);
  });

  it('should get repo folder', () => {
    const { repoName, repoFolder } = utilService.getRepoFolder(TestUser);

    expect(repoName).toEqual('tc/repo');
    expect(repoFolder).toEqual('test-user!tc%2Frepo!admin');
  });

  it('should highlight variable correctly', () => {
    expect(utilService.highlightNodeVariable(new TreeNode('key', PROPERTY_VALUE_TYPES.BOOLEAN, true))).toEqual(true);
    expect(utilService.highlightNodeVariable(new TreeNode('key', PROPERTY_VALUE_TYPES.NUMBER, 10))).toEqual(10);
    expect(utilService.highlightNodeVariable(new TreeNode('key', PROPERTY_VALUE_TYPES.STRING, '\\aa"bb"cc')))
      .toEqual('\\aa&quot;bb&quot;cc');
    expect(utilService.highlightNodeVariable(new TreeNode('key', PROPERTY_VALUE_TYPES.STRING, '<span></span>')))
      .toEqual('&lt;span&gt;&lt;/span&gt;');

    const $ = cheerio.load('<span></span>');
    const span = $('span');
    span.append($('<span></span>').text(percyConfig.variablePrefix));
    span.append($('<span class="yaml-var"></span>').text('name'));
    span.append($('<span></span>').text(percyConfig.variableSuffix));
    expect(utilService.highlightNodeVariable(new TreeNode('key', PROPERTY_VALUE_TYPES.STRING, constructVar('name')))).toEqual(span.html());
  });
});
