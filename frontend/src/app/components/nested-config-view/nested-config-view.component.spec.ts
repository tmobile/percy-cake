import * as _ from 'lodash';
import { Setup, assertDialogOpened } from 'test/test-helper';

import { NestedConfigViewComponent } from './nested-config-view.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { PROPERTY_VALUE_TYPES } from 'config';
import { ConfigProperty } from 'models/config-property';

describe('NestedConfigViewComponent', () => {
  const config = {
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
    },
    'environments': {
      'qat': {
          'api': {
            '$type': 'object',
            'urls': {
              '$type': 'object',
              'getCatalog': {
                '$type': 'string',
                '$value': '{{api.host}}/api/catalog?device=phone&pageSize={{size}}&pageNum={{page}}'
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
              ],
              '$type': 'array'
            },
          },
          '$type': 'object'
      },
      '$type': 'object'
    }
  };

  const environments = ['dev', 'qat'];

  const ctx = Setup(NestedConfigViewComponent);

  it('should create NestedConfigViewComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('should expand all trees initially and then able to toggle', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0])).toBeTruthy();
    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0].children[0])).toBeTruthy();
    expect(ctx().component.envTreeControl.isExpanded(ctx().component.envDataSource.data[0])).toBeTruthy();
    expect(ctx().component.envTreeControl.isExpanded(ctx().component.envDataSource.data[0].children[0])).toBeTruthy();

    ctx().component.toggle(ctx().component.defaultTreeControl, ctx().component.defaultDataSource.data[0], true);
    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0])).toBeFalsy();
    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0].children[0])).toBeFalsy();

    ctx().component.toggle(ctx().component.defaultTreeControl, ctx().component.defaultDataSource.data[0], false);
    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0])).toBeTruthy();

    ctx().component.toggle(ctx().component.defaultTreeControl, ctx().component.defaultDataSource.data[0], false);
    expect(ctx().component.defaultTreeControl.isExpanded(ctx().component.defaultDataSource.data[0])).toBeFalsy();
  });


  it('should open dialog to add environment in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [
        {
          key: 'dev',
          type: 'object'
        },
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to add property in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [
        {
          key: 'inherits',
          type: 'string'
        }
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to add nested property in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [
        {
          key: 'host',
          type: 'string'
        },
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to add nested property in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0].children[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [
        {
          key: 'getDetails',
          type: 'string'
        },
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to add string item property in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0].children[0].children[1];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [
        {
          key: '[1]',
          type: 'string'
        },
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to add propery in default tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.defaultDataSource.data[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      keyOptions: [],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0]
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to edit propery in default tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.defaultDataSource.data[0].children[0];
    ctx().component.openEditPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: true,
      keyOptions: [],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0],
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should open dialog to edit propery in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0];
    ctx().component.openEditPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: true,
      keyOptions: [
        {
          key: 'qat',
          type: 'object'
        }
      ],
      node,
      defaultTree: ctx().component.defaultDataSource.data[0],
    };
    expect(ctx().observables.addEditProperty.value).toEqual(result);
  });

  it('should save added propery in default tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.defaultDataSource.data[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const newNode = _.cloneDeep(node.children[0]);
    ctx().component.saveAddEditProperty(newNode);

    expect(node.children[node.children.length - 1]).toEqual(newNode);
  });

  it('should save added propery in environments tree', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0].children[0];
    ctx().component.openAddPropertyDialog(node);

    const newNode = _.cloneDeep(node.children[0]);
    ctx().component.saveAddEditProperty(newNode);

    expect(node.children[node.children.length - 1]).toEqual(newNode);
  });

  it('should save edited default propery', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.defaultDataSource.data[0].children[0].children[0];
    ctx().component.openEditPropertyDialog(node);

    const newNode = _.cloneDeep(node);
    newNode.key = 'new key';
    newNode.value = 'new value';
    newNode.valueType = PROPERTY_VALUE_TYPES.STRING;
    newNode.comment = ['new comment'];
    ctx().component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
  });

  it('should save edited array propery', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.defaultDataSource.data[0].children[0].children[2];
    ctx().component.openEditPropertyDialog(node);

    const newNode = _.cloneDeep(node);
    newNode.value = undefined;
    newNode.children = [];
    newNode.valueType = PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY;
    newNode.comment = ['new comment'];
    ctx().component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
    expect(node.children).toEqual(newNode.children);
  });

  it('should save edited environment', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const node = ctx().component.envDataSource.data[0].children[0];
    ctx().component.openEditPropertyDialog(node);

    const newNode = _.cloneDeep(node);
    newNode.comment = ['new comment'];
    ctx().component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
  });

  it('should emit configuration change', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    ctx().component.refreshTree();
    expect(ctx().observables.configurationChange.value).toEqual({
      default: ctx().component.defaultDataSource.data[0].jsonValue,
      environments: ctx().component.envDataSource.data[0].jsonValue
    });

    ctx().component.isEnvMode = true;
    ctx().component.refreshTree();
    expect(ctx().observables.configurationChange.value).toEqual({
      default: ctx().component.defaultDataSource.data[0].jsonValue,
    });
  });

  it('should delete property', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    ctx().component.deleteProperty(ctx().component.defaultDataSource.data[0].children[0]);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'Are you sure you want to delete this property?'
      }
    });
    ctx().dialogStub.output.next(true);

    expect(ctx().component.defaultDataSource.data[0].children.length).toEqual(0);

    expect(ctx().component.envDataSource.data[0].children[0].children.length).toEqual(0);
  });

  it('should delete array item property', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    const descendants = ctx().component.defaultTreeControl.getDescendants(ctx().component.defaultDataSource.data[0]);
    const found = _.find(descendants, { valueType: 'string[]' });

    ctx().component.deleteProperty(found.children[0]);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'Are you sure you want to delete this property?'
      }
    });
    ctx().dialogStub.output.next(true);

    expect(found.children.length).toEqual(1);
    expect(found.children[0].key).toEqual('[0]');
  });

  it('should emit various actions', () => {
    ctx().component.configuration = config;
    ctx().component.environments = environments;
    ctx().component.ngOnChanges();

    ctx().component.cancelAddEditProperty();
    expect(ctx().observables.cancelAddEditPropertyChange.value).toBeUndefined();

    ctx().component.showDetail(ctx().component.envDataSource.data[0]);
    expect(ctx().observables.selectedNode.value).toEqual(ctx().component.envDataSource.data[0]);

    ctx().component.viewCompiledYAML('qat');
    expect(ctx().observables.viewCompiledYAMLEvent.value).toEqual('qat');
  });

  it('should open menu', () => {
    const menuTrigger = {
      style: {},
      click: () => {}
    };
    spyOn(menuTrigger, 'click');
    ctx().component.openMenu(new Event('click'), menuTrigger);
    expect(menuTrigger.click).toHaveBeenCalled();

    const menuButton = {
      _elementRef: {
        nativeElement: {
          click: () => {}
        }
      },
    };
    spyOn(menuButton._elementRef.nativeElement, 'click');
    ctx().component.buttonOpenMenu(new Event('click'), menuButton);
    expect(menuButton._elementRef.nativeElement.click).toHaveBeenCalled();
  });

});
