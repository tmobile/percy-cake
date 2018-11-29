import { Setup } from 'test/test-helper';

import { AddEditPropertyDialogComponent } from './add-edit-property-dialog.component';
import { PROPERTY_VALUE_TYPES } from 'config';
import { TreeNode } from 'models/tree-node';
import { UtilService } from 'services/util.service';
import { ConfigProperty } from 'models/config-property';

describe('AddEditPropertyDialogComponent', () => {

  const ctx = Setup(AddEditPropertyDialogComponent, false);

  it('should create AddEditPropertyDialogComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('edit root object node', () => {
    const data = {
      editMode: true,
      node: new TreeNode('default', null, PROPERTY_VALUE_TYPES.OBJECT, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('edit non-root boolean propery in default tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('keyname', true, PROPERTY_VALUE_TYPES.BOOLEAN, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value + '');
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeFalsy();
  });

  it('edit non-root boolean propery in environments tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('keyname', true, PROPERTY_VALUE_TYPES.BOOLEAN, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value + '');
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('edit non-root number propery in default tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('keyname', 0, PROPERTY_VALUE_TYPES.NUMBER, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value);
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeFalsy();
  });

  it('edit non-root number propery in environments tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('keyname', 0, PROPERTY_VALUE_TYPES.NUMBER, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value);
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('edit non-root string array item propery in default tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('keyname', 'Lopuse', PROPERTY_VALUE_TYPES.STRING, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');
    data.node.parent.valueType = PROPERTY_VALUE_TYPES.STRING_ARRAY;
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value);
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('add non-root string array item propery in environments tree', () => {
    const data = {
      editMode: false,
      node: new TreeNode('keyname'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    data.node.children = [];
    data.node.valueType = PROPERTY_VALUE_TYPES.STRING_ARRAY;
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(`[${data.node.children.length}]`);
    expect(ctx().component.valueType.value).toEqual(data.node.getArrayItemType());
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('add non-root propery in default tree', () => {
    const data = {
      editMode: false,
      node: new TreeNode('keyname'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');
    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toBeNull();
    expect(ctx().component.valueType.value).toBeNull();
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeFalsy();
    expect(ctx().component.showInherits()).toBeFalsy();
  });

  it('add non-root propery in environments tree', () => {
    const data = {
      editMode: false,
      node: new TreeNode('keyname'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toBeNull();
    expect(ctx().component.valueType.value).toBeNull();
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeTruthy();
  });

  it('add inherits propery in environments tree', () => {
    const data = {
      editMode: false,
      node: new TreeNode('prod'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    data.node.parent.children = [data.node];
    data.node.parent.children.push(new TreeNode('dev'));

    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toBeNull();
    expect(ctx().component.valueType.value).toBeNull();
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeTruthy();

    ctx().component.key.setValue('inherits');

    expect(ctx().component.showInherits()).toBeTruthy();
    expect(ctx().component.inheritsOptions).toEqual(['dev']);
  });

  it('add inherits propery in environments tree, cylic should be excluded', () => {
    const data = {
      editMode: false,
      node: new TreeNode('prod'),
      defaultTree: null,
      keyOptions: []
    };
    data.node.parent = new TreeNode('environments');
    data.node.parent.children = [data.node];
    data.node.parent.children.push(new TreeNode('dev'));
    data.node.parent.children[1].children = [new TreeNode('inherits')];
    data.node.parent.children[1].children[0].value = 'prod';

    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toBeNull();
    expect(ctx().component.valueType.value).toBeNull();
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeTruthy();

    ctx().component.key.setValue('inherits');

    expect(ctx().component.showInherits()).toBeTruthy();
    expect(ctx().component.inheritsOptions).toEqual([]);
  });

  it('add inherits propery in environments tree, cylic should be excluded', () => {
    const data = {
      editMode: false,
      node: new TreeNode('prod'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    data.node.parent.children = [data.node];
    data.node.parent.children.push(new TreeNode('dev'));
    data.node.parent.children.push(new TreeNode('qa'));
    data.node.parent.children[1].children = [new TreeNode('inherits')];
    data.node.parent.children[1].children[0].value = 'qa';
    data.node.parent.children[2].children = [new TreeNode('inherits')];
    data.node.parent.children[2].children[0].value = 'prod';

    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toBeNull();
    expect(ctx().component.valueType.value).toBeNull();
    expect(ctx().component.value.value).toBeNull();
    expect(ctx().component.comment.value).toBeNull();

    expect(ctx().component.key.disabled).toBeFalsy();
    expect(ctx().component.valueType.disabled).toBeTruthy();

    ctx().component.key.setValue('inherits');

    expect(ctx().component.showInherits()).toBeTruthy();
    expect(ctx().component.inheritsOptions).toEqual([]);
  });

  it('edit inherits propery in environments tree', () => {
    const data = {
      editMode: true,
      node: new TreeNode('inherits', 'prod', PROPERTY_VALUE_TYPES.STRING, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode('environments');
    root.children = [new TreeNode('dev'), new TreeNode('prod'), new TreeNode('qa')];
    root.children[0].parent = root;
    root.children[1].parent = root;
    root.children[2].parent = root;

    root.children[0].children = [data.node];
    data.node.parent = root.children[0];

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.key.value).toEqual(data.node.key);
    expect(ctx().component.value.value).toEqual(data.node.value);
    expect(ctx().component.valueType.value).toEqual(data.node.valueType);
    expect(ctx().component.comment.value).toEqual(data.node.comment);

    expect(ctx().component.key.disabled).toBeTruthy();
    expect(ctx().component.valueType.disabled).toBeTruthy();

    expect(ctx().component.showInherits()).toBeTruthy();
    expect(ctx().component.inheritsOptions).toEqual(['prod', 'qa']);

    expect(ctx().component.showInherits()).toBeTruthy();
    expect(ctx().component.inheritsOptions).toEqual(['prod', 'qa']);
  });

  it('get breadcrumb in add mode', () => {
    const data = {
      editMode: false,
      node: new TreeNode('level1'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.getBreadCrumb()).toEqual('default.level1');

    ctx().component.key.setValue('newkey');
    expect(ctx().component.getBreadCrumb()).toEqual('default.level1.newkey');
  });

  it('get breadcrumb in edit mode', () => {
    const data = {
      editMode: true,
      node: new TreeNode('level1', 'Lopuse', PROPERTY_VALUE_TYPES.STRING, ['some comment']),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('default');

    ctx().component.data = data;
    ctx().component.ngOnChanges();

    expect(ctx().component.getBreadCrumb()).toEqual('default.level1');

    ctx().component.key.setValue('newkey');
    expect(ctx().component.getBreadCrumb()).toEqual('default.newkey');
  });

  it('add property, should submit changes', () => {
    const data = {
      editMode: false,
      node: new TreeNode('keyname'),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode('environments');
    data.node.valueType = PROPERTY_VALUE_TYPES.OBJECT;
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    ctx().component.key.setValue('newkey');
    ctx().component.valueType.setValue(PROPERTY_VALUE_TYPES.STRING);
    ctx().component.value.setValue('newvalue');
    ctx().component.comment.setValue('line1\nline2');

    const result = new TreeNode('newkey');
    result.key = ctx().component.key.value;
    result.valueType = ctx().component.valueType.value;
    result.value = ctx().component.value.value;
    result.comment = ctx().component.comment.value.split('\n');

    ctx().component.onSubmit();
    expect(ctx().observables.saveProperty.value).toEqual(result);
  });

  it('add property, should submit changes with default values', () => {
    const defaultJSON = {
      'default': {
        'api': {
          '$comment': ['urls used by this application'],
          '$type': 'object',
          'host': {
            '$comment': ['qat data server'],
            '$type': 'string',
            '$value': 'https://pd01.qat.t-mobile.com:9000'
          },
          'urls': {
            '$type': 'object',
            'getCatalog': {
              '$type': 'string',
              '$value': '{{api.host}}/api/catalog?device=phone&pageSize={{size}}&pageNum={{page}}'
            },
            'getDetails': {
              '$type': 'string',
              '$value': '{{api.host}}/api/product/details/{{deviceId}}'
            },
            '$comment': [
              'all known properties are defined in the default block.',
              'The most common values are assigned in the default block'
            ],
          },
          'staging-items': {
            '$value': [
                {
                    '$comment': ['item1 comment'],
                    '$value': 'item1',
                    '$type': 'string'
                },
                {
                    '$comment': ['item2 comment'],
                    '$value': 'item2',
                    '$type': 'string'
                },
            ],
            '$type': 'array'
          },
        },
        '$type': 'object'
      }
    };

    const utilService = new UtilService();
    const defaultRoot = utilService.buildConfigTree(defaultJSON.default, 'default');

    const environmentsJSON = {
      'environments': {
        'qat': {
            'api': {
              '$type': 'object',
              'host': {
                '$type': 'string',
                '$value': 'https://pd03.qat.t-mobile.com'
              }
            },
            '$type': 'object'
        },
        '$type': 'object'
      }
    };
    const envRoot = utilService.buildConfigTree(environmentsJSON.environments, 'environments');

    const data: ConfigProperty = {
      editMode: false,
      node: envRoot.children[0].children[0], // Add property to 'environments.qat.api'
      keyOptions: [],
      defaultTree: defaultRoot
    };
    ctx().component.data = data;
    ctx().component.ngOnChanges();

    ctx().component.key.setValue('urls'); // Add 'urls' property
    ctx().component.useDefault({ checked: true});
    ctx().component.onSubmit();

    const result = utilService.buildConfigTree(
      defaultRoot.children[0].children[1].jsonValue,
      'urls',
      data.editMode ? data.node.parent : data.node);
    expect(ctx().observables.saveProperty.value).toEqual(result);
  });

  it('should cancle changes', () => {
    ctx().component.onCancel();
    expect(ctx().observables.saveProperty.value).toBeUndefined();
    expect(ctx().observables.cancel.value).toBeUndefined();
  });

  it('should set value type', () => {
    ctx().component.data = {
      editMode: true,
      node: null,
      defaultTree: null,
      keyOptions: [
        {
          key: 'key1',
          type: 'type1'
        },
        {
          key: 'key2',
          type: 'type2'
        }
      ]
    };
    ctx().component.setValueTypeOption('key2');
    expect(ctx().component.valueType.value).toEqual('type2');
  });
});
