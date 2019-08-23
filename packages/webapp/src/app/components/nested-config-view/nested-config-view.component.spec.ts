import { Setup, assertDialogOpened, TestContext, utilService } from "test/test-helper";

import { NestedConfigViewComponent } from "./nested-config-view.component";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { PROPERTY_VALUE_TYPES } from "config";
import { ConfigProperty } from "models/config-property";
import { Configuration } from "models/config-file";
import { TreeNode } from "models/tree-node";

describe("NestedConfigViewComponent", () => {
  const environments = ["dev", "qat"];

  const setup = Setup(NestedConfigViewComponent, false);

  let ctx: TestContext<NestedConfigViewComponent>;

  let config: Configuration;

  beforeEach(() => {
    ctx = setup();
    config = new Configuration();
    config.default.addChild(new TreeNode("url", PROPERTY_VALUE_TYPES.STRING, "http://test"));
    config.default.addChild(new TreeNode("obj"));
    config.default.findChild(["obj"]).addChild(new TreeNode("host", PROPERTY_VALUE_TYPES.STRING, "test.com"));
    config.default.findChild(["obj"]).addChild(new TreeNode("port", PROPERTY_VALUE_TYPES.NUMBER, 80));
    config.default.addChild(new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY));
    config.default.addChild(new TreeNode("arr2", PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY));
    config.default.addChild(new TreeNode("arr3", PROPERTY_VALUE_TYPES.NUMBER_ARRAY));
    config.default.findChild(["arr2"]).addChild(new TreeNode("item1", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.default.findChild(["arr2"]).addChild(new TreeNode("item2", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    config.default.addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    config.default.findChild(["objarr"]).addChild(new TreeNode("[0]"));
    config.default.findChild(["objarr", "[0]"]).anchor = "objarr-0";
    config.default.findChild(["objarr", "[0]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.default.findChild(["objarr"]).addChild(new TreeNode("[1]"));
    config.default.findChild(["objarr", "[1]"]).anchor = "objarr-1";
    config.default.findChild(["objarr", "[1]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    config.environments.addChild(new TreeNode("dev"));
    config.environments.findChild(["dev"]).addChild(new TreeNode("obj"));
    config.environments.findChild(["dev", "obj"]).addChild(new TreeNode("host", PROPERTY_VALUE_TYPES.STRING, "test.com"));
    config.environments.findChild(["dev"]).addChild(new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY));
    config.environments.findChild(["dev"]).addChild(new TreeNode("arr2", PROPERTY_VALUE_TYPES.BOOLEAN_ARRAY));
    config.environments.findChild(["dev"]).addChild(new TreeNode("arr3", PROPERTY_VALUE_TYPES.NUMBER_ARRAY));
    config.environments.findChild(["dev", "arr"]).addChild(new TreeNode("item1", PROPERTY_VALUE_TYPES.STRING, "value1"));
    config.environments.findChild(["dev", "arr"]).addChild(new TreeNode("item2", PROPERTY_VALUE_TYPES.STRING, "value2"));
    config.environments.findChild(["dev", "arr2"]).addChild(new TreeNode("item1", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    config.environments.findChild(["dev", "arr2"]).addChild(new TreeNode("item2", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    config.environments.findChild(["dev"]).addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    config.environments.findChild(["dev", "objarr"]).addChild(new TreeNode("[0]"));
    config.environments.findChild(["dev", "objarr", "[0]"]).aliases = ["objarr-0"];
    config.environments.findChild(["dev", "objarr"]).addChild(new TreeNode("[1]"));
    config.environments.findChild(["dev", "objarr", "[1]"]).aliases = ["objarr-1"];

    config.environments.addChild(new TreeNode("qa"));
    config.environments.findChild(["qa"]).addChild(new TreeNode("inherits", PROPERTY_VALUE_TYPES.STRING, "dev"));

    ctx.component.configuration = config;
    ctx.component.environments = environments;
    ctx.component.envFileMode = false;
    ctx.component.ngOnChanges({
      configuration: <any>{}
    });
  });

  it("should create NestedConfigViewComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("should expand all trees initially and then able to toggle", () => {

    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0])).toBeTruthy();
    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0].children[0])).toBeTruthy();
    expect(ctx.component.envTreeControl.isExpanded(ctx.component.envDataSource.data[0])).toBeTruthy();
    expect(ctx.component.envTreeControl.isExpanded(ctx.component.envDataSource.data[0].children[0])).toBeTruthy();

    ctx.component.toggle(ctx.component.defaultTreeControl, ctx.component.defaultDataSource.data[0], true);
    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0])).toBeFalsy();
    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0].children[0])).toBeFalsy();

    ctx.component.toggle(ctx.component.defaultTreeControl, ctx.component.defaultDataSource.data[0], false);
    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0])).toBeTruthy();

    ctx.component.toggle(ctx.component.defaultTreeControl, ctx.component.defaultDataSource.data[0], false);
    expect(ctx.component.defaultTreeControl.isExpanded(ctx.component.defaultDataSource.data[0])).toBeFalsy();
  });


  it("should open dialog to add environment in environments tree", () => {
    const node = config.environments;
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: "qat",
          type: PROPERTY_VALUE_TYPES.OBJECT
        },
      ],
      node,
      defaultTree: config.default
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add property in environments tree", () => {
    const node = config.environments.findChild(["dev"]);
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: "inherits", type: PROPERTY_VALUE_TYPES.STRING
        },
        {
          key: "url", type: PROPERTY_VALUE_TYPES.STRING
        },
      ],
      node,
      defaultTree: config.default
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add nested property in environments tree", () => {
    const node = config.environments.findChild(["dev", "obj"]);
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: "port",
          type: PROPERTY_VALUE_TYPES.NUMBER
        },
      ],
      node,
      defaultTree: config.default
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add boolean item propery in environments tree", () => {

    const node = config.environments.findChild(["dev", "arr2"]);
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: `[${node.children.length}]`,
          type: PROPERTY_VALUE_TYPES.BOOLEAN
        }
      ],
      node,
      defaultTree: config.default,
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add number item propery in environments tree", () => {

    const node = config.environments.findChild(["dev", "arr3"]);
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: `[${node.children.length}]`,
          type: PROPERTY_VALUE_TYPES.NUMBER
        }
      ],
      node,
      defaultTree: config.default,
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add string item property in environments tree", () => {

    const node = config.environments.findChild(["dev", "arr"]);
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [
        {
          key: `[${node.children.length}]`,
          type: PROPERTY_VALUE_TYPES.STRING
        },
      ],
      node,
      defaultTree: config.default
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add propery in default tree", () => {

    const node = config.default;
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: false,
      keyOptions: [],
      node,
      defaultTree: config.default
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to edit propery in default tree", () => {

    const node = config.default.findChild(["obj"]);
    ctx.component.openEditPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: true,
      envFileMode: false,
      keyOptions: [],
      node,
      defaultTree: config.default,
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to edit propery in environments tree", () => {

    const node = config.environments.findChild(["dev", "obj"]);
    ctx.component.openEditPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: true,
      envFileMode: false,
      keyOptions: [
        {
          key: "obj",
          type: PROPERTY_VALUE_TYPES.OBJECT
        }
      ],
      node,
      defaultTree: config.default,
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should open dialog to add new environment name in environments.yaml", () => {
    ctx.component.envFileMode = true;

    const node = config.environments;
    ctx.component.openAddPropertyDialog(node);

    const result: ConfigProperty = {
      editMode: false,
      envFileMode: true,
      keyOptions: [],
      node,
      defaultTree: config.default,
    };
    expect(ctx.observables.addEditProperty.value).toEqual(result);
  });

  it("should save added propery in default tree", () => {

    const node = config.default.findChild(["obj"]);

    ctx.component.openAddPropertyDialog(node);

    const newNode = new TreeNode("key", PROPERTY_VALUE_TYPES.STRING, "value", ["key comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.findChild(["key"])).toEqual(newNode);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should save edited propery in default tree", () => {

    const node = config.default.findChild(["url"]);

    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("new url", PROPERTY_VALUE_TYPES.STRING, "http://newurl", ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should save added propery in environments tree", () => {
    const node = config.environments.findChild(["dev", "obj"]);
    ctx.component.openAddPropertyDialog(node);

    const newNode = new TreeNode("key", PROPERTY_VALUE_TYPES.STRING, "value");
    ctx.component.saveAddEditProperty(newNode);

    expect(node.findChild(["key"])).toEqual(newNode);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("rename propery in default tree, correpsonding properties in environments tree should also be renamed", () => {

    config.default.addChild(
      new TreeNode("variable", PROPERTY_VALUE_TYPES.STRING, utilService.constructVariable("url")));
    config.environments.findChild(["dev"]).addChild(
      new TreeNode("variable", PROPERTY_VALUE_TYPES.STRING, utilService.constructVariable("url")));

    const node = config.default.findChild(["url"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("new url", PROPERTY_VALUE_TYPES.STRING, "new value", ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);

    const defaultNode = config.default.findChild(["variable"]);
    expect(defaultNode.value).toEqual(utilService.constructVariable("new url"));

    const envNode = config.environments.findChild(["dev", "variable"]);
    expect(envNode.value).toEqual(utilService.constructVariable("new url"));

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("rename anchor in default tree, referenced alias should also be renamed", () => {

    const node = config.default.findChild(["objarr", "[0]"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("[0]");
    newNode.anchor = "objarr-00";
    ctx.component.saveAddEditProperty(newNode);

    const envNode = config.environments.findChild(["dev", "objarr", "[0]"]);

    expect(envNode.aliases).toEqual(["objarr-00"]);
    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("delete anchor in default tree, referenced alias should also be deleted", () => {

    const node = config.default.findChild(["objarr", "[0]"]);

    ctx.component.deleteProperty(node);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: "Are you sure you want to delete this property?"
      }
    });
    ctx.dialogStub.output.next(true);

    expect(config.default.findChild(["objarr"]).children.length).toEqual(1);
    expect(config.default.findChild(["objarr", "[0]"])).toBeDefined();
    expect(config.environments.findChild(["dev", "objarr"]).children.length).toEqual(1);
    expect(config.environments.findChild(["dev", "objarr", "[0]"])).toBeDefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("rename propery in default tree, referenced variable should also be renamed", () => {

    const node = config.default.findChild(["obj", "host"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("new host", PROPERTY_VALUE_TYPES.STRING, "new value", ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);

    const envNode = config.environments.findChild(["dev", "obj", "new host"]);
    expect(envNode).toBeDefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("change propery type in default tree, correpsonding properties in environments tree should be deleted", () => {

    const node = config.default.findChild(["obj"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("obj", PROPERTY_VALUE_TYPES.STRING, "new value", ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);

    const envNode = config.environments.findChild(["dev", "obj"]);
    expect(envNode).toBeUndefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("change array type in default tree, correpsonding properties in environments tree should be deleted", () => {

    const node = config.default.findChild(["arr"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING, "new value", ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
    expect(node.children).toBeUndefined();

    const envNode = config.environments.findChild(["dev", "arr"]);
    expect(envNode).toBeUndefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should save edited array propery with new children", () => {
    const node = config.default.findChild(["arr"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY, undefined, ["some comment"]);
    newNode.addChild(new TreeNode("[0]", PROPERTY_VALUE_TYPES.STRING, "item1"));
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
    expect(node.children.length).toEqual(1);
    expect(node.children[0].parent).toEqual(node);
    expect(node.children[0].key).toEqual("[0]");
    expect(node.children[0].value).toEqual("item1");
    expect(node.children[0].valueType).toEqual(PROPERTY_VALUE_TYPES.STRING);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should save edited array propery with existing children", () => {
    const node = config.default.findChild(["arr"]);
    ctx.component.openEditPropertyDialog(node);

    const newNode = new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY, undefined, ["some comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
    expect(node.children.length).toEqual(0);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should save edited property in environments tree", () => {

    const node = config.environments.findChild(["dev", "arr"]);
    ctx.component.openEditPropertyDialog(node);

    const prevChildrenLength = node.children.length;
    const newNode = new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY, undefined, ["new comment"]);
    ctx.component.saveAddEditProperty(newNode);

    expect(node.key).toEqual(newNode.key);
    expect(node.value).toEqual(newNode.value);
    expect(node.valueType).toEqual(newNode.valueType);
    expect(node.comment).toEqual(newNode.comment);
    expect(node.children.length).toEqual(prevChildrenLength);

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("delete env from environments tree, related inherits propery in environments tree should also be deleted", () => {
    const node = config.environments.findChild(["dev"]);
    ctx.component.deleteProperty(node);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: "Are you sure you want to delete this environment?"
      }
    });
    ctx.dialogStub.output.next(true);

    expect(config.environments.findChild(["dev"])).toBeUndefined();

    expect(config.environments.findChild(["qa", "inherits"])).toBeUndefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("delete property from default tree, corresponding propery in environments tree should also be deleted", () => {
    const node = config.default.findChild(["obj"]);
    ctx.component.deleteProperty(node);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: "Are you sure you want to delete this property?"
      }
    });
    ctx.dialogStub.output.next(true);

    expect(config.default.findChild(["obj"])).toBeUndefined();

    expect(config.environments.findChild(["dev", "obj"])).toBeUndefined();

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should delete array item property", () => {
    const node = config.default.findChild(["arr2"]);

    ctx.component.deleteProperty(node.children[0]);

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: "Are you sure you want to delete this property?"
      }
    });
    ctx.dialogStub.output.next(true);

    expect(node.children.length).toEqual(1);
    expect(node.children[0].key).toEqual("[0]");

    // const envnode = config.environments.findChild(['dev', 'arr2']);
    // expect(envnode.children.length).toEqual(1);
    // expect(envnode.children[0].key).toEqual('[0]');

    expect(ctx.observables.configurationChange.value).toEqual(config);
  });

  it("should emit various actions", () => {
    ctx.component.cancelAddEditProperty();
    expect(ctx.observables.cancelAddEditPropertyChange.value).toBeUndefined();

    ctx.component.showDetail(ctx.component.envDataSource.data[0]);
    expect(ctx.observables.selectedNode.value).toEqual(ctx.component.envDataSource.data[0]);

    ctx.component.viewCompiledYAML("qat");
    expect(ctx.observables.viewCompiledYAMLEvent.value).toEqual("qat");
  });

  it("should open menu", () => {
    const menuTrigger = {
      style: {},
      offsetParent: {},
      click: () => { }
    };
    spyOn(menuTrigger, "click");
    ctx.component.openMenu(new Event("click"), menuTrigger);
    expect(menuTrigger.click).toHaveBeenCalled();

    const menuButton = {
      click: () => { }
    };
    spyOn(menuButton, "click");
    ctx.component.buttonOpenMenu(new Event("click"), menuButton);
    expect(menuButton.click).toHaveBeenCalled();
  });
});
