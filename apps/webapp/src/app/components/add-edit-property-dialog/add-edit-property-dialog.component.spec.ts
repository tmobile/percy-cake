import * as _ from "lodash";
import { SETUP, TestContext, assertDialogOpened } from "test/test-helper";

import { TreeNode, PROPERTY_VALUE_TYPES } from "models/tree-node";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";

import { AddEditPropertyDialogComponent } from "./add-edit-property-dialog.component";

describe("AddEditPropertyDialogComponent", () => {
  const setup = SETUP(AddEditPropertyDialogComponent, false);

  let ctx: TestContext<AddEditPropertyDialogComponent>;
  let dispatchSpy: jasmine.Spy;

  beforeEach(() => {
    ctx = setup();
    dispatchSpy = spyOn(ctx.store, "dispatch");
  });

  it("should create AddEditPropertyDialogComponent", () => {
    expect(ctx.component).toBeTruthy();
  });

  it("edit root default node", () => {
    const data = {
      editMode: true,
      node: new TreeNode("default", PROPERTY_VALUE_TYPES.OBJECT, null, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("edit non-root boolean propery in default tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.BOOLEAN, true, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode("default");
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value + "");
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeFalsy();
  });

  it("edit non-root boolean propery in environments tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.BOOLEAN, true, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value + "");
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("edit non-root number propery in default tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.NUMBER, 0, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode("default");
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeFalsy();
  });

  it("edit non-root number propery in default tree with NaN value", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.NUMBER, null, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode("default");
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeFalsy();
  });

  it("edit non-root number propery in environments tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.NUMBER, 0, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("edit string array item propery in default tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("[0]", PROPERTY_VALUE_TYPES.STRING, "Lopuse", ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(new TreeNode("arr", PROPERTY_VALUE_TYPES.STRING_ARRAY));
    root.findChild(["arr"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("add string array propery in environments tree", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.STRING_ARRAY),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(`[${data.node.children.length}]`);
    expect(ctx.component.valueType.value).toEqual(data.node.getArrayItemType());
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("add non-root propery in default tree", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.parent = new TreeNode("default");
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual("");
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeFalsy();
    expect(ctx.component.showInherits()).toBeFalsy();
  });

  it("add new environment in environments.yaml file", () => {
    const data = {
      editMode: false,
      envFileMode: true,
      node: new TreeNode("environments"),
      keyOptions: [],
      defaultTree: null,
    };
    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual("object");
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("add environment name in environments.yaml file, duplicate exists, should not submit", () => {
    const data = {
      editMode: false,
      envFileMode: true,
      node: new TreeNode("environments"),
      keyOptions: [],
      defaultTree: null,
    };
    data.node.addChild(new TreeNode("prod"));

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.key.setValue("prod");
    ctx.component.onSubmit();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload).toEqual({
      message: `Property key 'prod' already exists`,
      alertType: "error"
    });
    expect(ctx.observables.saveProperty.value).toBeUndefined();
  });

  it("edit environment name in environments.yaml file", () => {
    const data = {
      editMode: true,
      envFileMode: true,
      node: new TreeNode("dev", PROPERTY_VALUE_TYPES.OBJECT, null, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();
  });

  it("edit environment name in environments.yaml file, duplicate exists, should not submit", () => {
    const data = {
      editMode: true,
      envFileMode: true,
      node: new TreeNode("dev", PROPERTY_VALUE_TYPES.OBJECT, null, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(data.node);
    root.addChild(new TreeNode("prod"));

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.key.setValue("prod");
    ctx.component.onSubmit();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload).toEqual({
      message: `Property key 'prod' already exists`,
      alertType: "error"
    });
    expect(ctx.observables.saveProperty.value).toBeUndefined();
  });

  it("add inherits propery in environments tree", async () => {
    const data = {
      editMode: false,
      node: new TreeNode("prod"),
      keyOptions: [{ key: "inherits", type: PROPERTY_VALUE_TYPES.STRING }],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(data.node);
    root.addChild(new TreeNode("dev"));

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual("");
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.key.setValue("inherits");

    expect(ctx.component.showInherits()).toBeTruthy();
    expect(ctx.component.inheritsOptions).toEqual(["dev"]);
  });

  it("add inherits propery in environments tree, cylic should be excluded", () => {
    const data = {
      editMode: false,
      node: new TreeNode("prod"),
      keyOptions: [{ key: "inherits", type: PROPERTY_VALUE_TYPES.STRING }],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(data.node);
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(new TreeNode("inherits", PROPERTY_VALUE_TYPES.STRING, "prod"));

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual("");
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.key.setValue("inherits");

    expect(ctx.component.showInherits()).toBeTruthy();
    expect(ctx.component.inheritsOptions).toEqual([]);
  });

  it("add inherits propery in environments tree, cylic should be excluded", () => {
    const data = {
      editMode: false,
      node: new TreeNode("prod"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(data.node);
    root.addChild(new TreeNode("dev"));
    root.addChild(new TreeNode("qat"));
    root.findChild(["dev"]).addChild(new TreeNode("inherits", PROPERTY_VALUE_TYPES.STRING, "qat"));
    root.findChild(["qat"]).addChild(new TreeNode("inherits", PROPERTY_VALUE_TYPES.STRING, "prod"));

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual("");
    expect(ctx.component.valueType.value).toEqual("");
    expect(ctx.component.value.value).toEqual("");
    expect(ctx.component.comment.value).toEqual("");

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.key.setValue("inherits");

    expect(ctx.component.showInherits()).toBeTruthy();
    expect(ctx.component.inheritsOptions).toEqual([]);
  });

  it("edit inherits propery in environments tree", () => {
    const data = {
      editMode: true,
      node: new TreeNode("inherits", PROPERTY_VALUE_TYPES.STRING, "prod", ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.addChild(new TreeNode("prod"));
    root.addChild(new TreeNode("qa"));

    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.value).toEqual(data.node.key);
    expect(ctx.component.value.value).toEqual(data.node.value);
    expect(ctx.component.valueType.value).toEqual(data.node.valueType);
    expect(ctx.component.comment.value).toEqual(data.node.comment.join("\n"));

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    expect(ctx.component.showInherits()).toBeTruthy();
    expect(ctx.component.inheritsOptions).toEqual(["prod", "qa"]);

    expect(ctx.component.showInherits()).toBeTruthy();
    expect(ctx.component.inheritsOptions).toEqual(["prod", "qa"]);
  });

  it("get breadcrumb in add mode", () => {
    const data = {
      editMode: false,
      node: new TreeNode("level1"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.getBreadCrumb()).toEqual("default.level1");

    ctx.component.key.setValue("newkey");
    expect(ctx.component.getBreadCrumb()).toEqual("default.level1.newkey");
  });

  it("get breadcrumb in edit mode", () => {
    const data = {
      editMode: true,
      node: new TreeNode("level1", PROPERTY_VALUE_TYPES.STRING, "Lopuse", ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.getBreadCrumb()).toEqual("default.level1");

    ctx.component.key.setValue("newkey");
    expect(ctx.component.getBreadCrumb()).toEqual("default.newkey");
  });

  it("get breadcrumb of root in edit mode", () => {
    const data = {
      editMode: true,
      node: new TreeNode("default"),
      keyOptions: [],
      defaultTree: null,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.getBreadCrumb()).toEqual("default");
  });

  it("add string property, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.STRING);
    ctx.component.value.setValue("newvalue");
    ctx.component.comment.setValue("line1\nline2");

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.STRING);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value;
    result.comment = ctx.component.comment.value.split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add string property with auto trim, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey ");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.STRING);
    ctx.component.value.setValue("newvalue ");
    ctx.component.comment.setValue("line1\nline2 ");

    ctx.component.useAutoTrim({ checked: true });

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.STRING);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value.trim();
    result.comment = ctx.component.comment.value.trim().split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add boolean property, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.BOOLEAN);
    ctx.component.value.setValue(true);
    ctx.component.comment.setValue("line1\nline2");

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.BOOLEAN);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value;
    result.comment = ctx.component.comment.value.split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add boolean property with auto trim, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey ");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.BOOLEAN);
    ctx.component.value.setValue(true);
    ctx.component.comment.setValue("line1\nline2 ");

    ctx.component.useAutoTrim({ checked: true });

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.BOOLEAN);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value;
    result.comment = ctx.component.comment.value.trim().split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add number property, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.NUMBER);
    ctx.component.value.setValue(10);
    ctx.component.comment.setValue("line1\nline2");

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.NUMBER);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value;
    result.comment = ctx.component.comment.value.split("\n");

    ctx.component.numberInput = {
      nativeElement: {
        value: ctx.component.value.value + ""
      }
    };
    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add number property with auto trim, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey ");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.NUMBER);
    ctx.component.value.setValue(10);
    ctx.component.comment.setValue("line1\nline2 ");

    ctx.component.useAutoTrim({ checked: true });

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.NUMBER);
    result.valueType = ctx.component.valueType.value;
    result.value = ctx.component.value.value;
    result.comment = ctx.component.comment.value.trim().split("\n");

    ctx.component.numberInput = {
      nativeElement: {
        value: ctx.component.value.value + ""
      }
    };
    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add array property, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.STRING_ARRAY);
    ctx.component.comment.setValue("line1\nline2");

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.STRING_ARRAY);
    result.valueType = ctx.component.valueType.value;
    result.comment = ctx.component.comment.value.split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add array property with auto trim, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey ");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.STRING_ARRAY);
    ctx.component.comment.setValue("line1\nline2 ");

    ctx.component.useAutoTrim({ checked: true });

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.STRING_ARRAY);
    result.valueType = ctx.component.valueType.value;
    result.comment = ctx.component.comment.value.trim().split("\n");

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add object property, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.OBJECT);

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.OBJECT);
    result.valueType = ctx.component.valueType.value;

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add object property with auto trim, should submit changes", () => {
    const data = {
      editMode: false,
      node: new TreeNode("keyname"),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("newkey ");
    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.OBJECT);

    ctx.component.useAutoTrim({ checked: true });

    const result = new TreeNode("newkey", PROPERTY_VALUE_TYPES.OBJECT);
    result.valueType = ctx.component.valueType.value;

    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("edit non-root number propery with invalid value, should not submit", () => {
    const data = {
      editMode: true,
      node: new TreeNode("keyname", PROPERTY_VALUE_TYPES.NUMBER, 0, ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.disabled).toBeTruthy();
    expect(ctx.component.valueType.disabled).toBeTruthy();

    ctx.component.value.setValue("");
    ctx.component.onSubmit();

    expect(ctx.observables.saveProperty.value).toBeUndefined();
  });

  it("change value type in default tree, confirm dialog should show", () => {
    const data = {
      editMode: true,
      node: new TreeNode("key", PROPERTY_VALUE_TYPES.STRING, "Lopuse", ["some comment"]),
      keyOptions: [],
      defaultTree: null,
    };
    const root = new TreeNode("default");
    root.addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.key.disabled).toBeFalsy();
    expect(ctx.component.valueType.disabled).toBeFalsy();

    ctx.component.valueType.setValue(PROPERTY_VALUE_TYPES.OBJECT);

    ctx.component.onSubmit();

    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'You have changed the value type, the corresponding property will be removed from all environments. Do you still want to make the change?' // eslint-disable-line
      }
    });

    ctx.dialogStub.output.next(true);

    const result = new TreeNode("key", PROPERTY_VALUE_TYPES.OBJECT);
    result.comment = ctx.component.comment.value.trim().split("\n");
  });

  it("add object in array with duplicate first sibling, should submit changes with first sibling properties", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[0]"));
    defaultTree.findChild(["objarr", "[0]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, true));

    const data = {
      editMode: false,
      node: defaultTree.findChild(["objarr"]),
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();
    expect(ctx.component.isNonFirstObjectInArray()).toBeTruthy();

    ctx.component.useFirstSibling({ checked: false });
    ctx.component.useFirstSibling({ checked: true });
    ctx.component.onSubmit();

    const firstSibling = defaultTree.findChild(["objarr", "[0]"]);
    firstSibling.parent = undefined;
    const result = _.cloneDeep(firstSibling);
    result.key = "[1]";
    result.anchor = "objarr-1";

    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("edit object in array with duplicate first sibling, should submit changes with first sibling properties", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[0]"));
    defaultTree.findChild(["objarr", "[0]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[1]"));
    defaultTree.findChild(["objarr", "[1]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    const data = {
      editMode: true,
      node: defaultTree.findChild(["objarr", "[1]"]),
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();
    expect(ctx.component.isNonFirstObjectInArray()).toBeTruthy();

    ctx.component.useFirstSibling({ checked: true });
    ctx.component.onSubmit();

    const firstSibling = defaultTree.findChild(["objarr", "[0]"]);
    firstSibling.parent = undefined;
    const result = _.cloneDeep(firstSibling);
    result.key = "[1]";
    result.anchor = "objarr-1";

    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("edit object in array of default nodes, should fail if duplicate anchor name", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[0]"));
    defaultTree.findChild(["objarr", "[0]"]).anchor = "objarr-0";
    defaultTree.findChild(["objarr", "[0]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[1]"));
    defaultTree.findChild(["objarr", "[1]"]).anchor = "objarr-1";
    defaultTree.findChild(["objarr", "[1]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    const data = {
      editMode: true,
      node: defaultTree.findChild(["objarr", "[1]"]),
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.anchor.setValue("objarr-0");
    ctx.component.onSubmit();

    const payload = dispatchSpy.calls.mostRecent().args[0].payload;
    expect(payload).toEqual({
      message: `Anchor name 'objarr-0' already exists`,
      alertType: "error"
    });
    expect(ctx.observables.saveProperty.value).toBeUndefined();
  });

  it("edit object in array with of env nodes, should show alias", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[0]"));
    defaultTree.findChild(["objarr", "[0]"]).anchor = "objarr-0";
    defaultTree.findChild(["objarr", "[0]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, true));
    defaultTree.findChild(["objarr"]).addChild(new TreeNode("[1]"));
    defaultTree.findChild(["objarr", "[1]"]).anchor = "objarr-1";
    defaultTree.findChild(["objarr", "[1]"]).addChild(new TreeNode("bool", PROPERTY_VALUE_TYPES.BOOLEAN, false));

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("qat"));
    root.findChild(["qat"]).addChild(new TreeNode("objarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    root.findChild(["qat", "objarr"]).addChild(new TreeNode("[0]"));
    root.findChild(["qat", "objarr", "[0]"]).aliases = ["objarr-0"];

    const data = {
      editMode: true,
      node: root.findChild(["qat", "objarr", "[0]"]),
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    expect(ctx.component.showAlias()).toBeTruthy();

    expect(ctx.component.alias.value).toEqual("objarr-0");

    expect(ctx.component.anchorsOptions).toEqual(["", "objarr-0", "objarr-1"]);

    ctx.component.alias.setValue("objarr-1");
    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value.aliases).toEqual(["objarr-1"]);

    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();
    expect(ctx.observables.saveProperty.value.aliases).toEqual(["objarr-1"]);
    expect(ctx.observables.saveProperty.value.findChild(["bool"]).value).toEqual(false);
  });

  it("add environment in environments tree with duplicate default, should submit changes with default values", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("obj"));
    defaultTree.findChild(["obj"]).addChild(new TreeNode("url", PROPERTY_VALUE_TYPES.STRING, "https://test", ["some comment"]));

    const root = new TreeNode("environments");

    const data = {
      editMode: false,
      node: root,
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("qat");
    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();

    const result = _.cloneDeep(defaultTree);
    result.key = "qat";

    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("edit environment in environments tree with duplicate default, should submit changes with default values", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("obj"));
    defaultTree.findChild(["obj"]).addChild(new TreeNode("url", PROPERTY_VALUE_TYPES.STRING, "https://test", ["some comment"]));

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("qat"));
    const data = {
      editMode: true,
      node: root.findChild(["qat"]),
      keyOptions: [],
      defaultTree,
    };

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();

    const result = _.cloneDeep(defaultTree);
    result.key = "qat";

    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("add property in environments tree with duplicate default, should submit changes with default values", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("obj"));
    defaultTree.findChild(["obj"]).addChild(new TreeNode("url", PROPERTY_VALUE_TYPES.STRING, "https://test", ["some comment"]));

    const data = {
      editMode: false,
      node: new TreeNode("obj"),
      keyOptions: [],
      defaultTree,
    };

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.key.setValue("url");
    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();

    const result = _.cloneDeep(defaultTree.findChild(["obj", "url"]));
    result.parent = undefined;
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("edit property in environments tree with duplicate default, should submit changes with default values", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("obj"));
    defaultTree.findChild(["obj"]).addChild(new TreeNode("url", PROPERTY_VALUE_TYPES.STRING, "https://test", ["some comment"]));

    const data = {
      editMode: true,
      node: new TreeNode("url"),
      keyOptions: [],
      defaultTree,
    };

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(new TreeNode("obj"));
    root.findChild(["dev", "obj"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();

    const result = _.cloneDeep(defaultTree.findChild(["obj", "url"]));
    result.parent = undefined;
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("duplicate default of object array, should copy alias instead of full array", () => {

    const defaultTree = new TreeNode("default");
    defaultTree.addChild(new TreeNode("oarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY));
    defaultTree.findChild(["oarr"]).addChild(new TreeNode("[0]"));
    defaultTree.findChild(["oarr", "[0]"]).anchor = "oarr-0";
    defaultTree.findChild(["oarr"]).addChild(new TreeNode("[1]"));
    defaultTree.findChild(["oarr", "[1]"]).anchor = "oarr-1";

    const data = {
      editMode: true,
      node: new TreeNode("oarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY),
      keyOptions: [],
      defaultTree,
    };

    const root = new TreeNode("environments");
    root.addChild(new TreeNode("dev"));
    root.findChild(["dev"]).addChild(data.node);

    ctx.component.data = data;
    ctx.component.ngOnChanges();

    ctx.component.useDefault({ checked: true });
    ctx.component.onSubmit();

    const result = new TreeNode("oarr", PROPERTY_VALUE_TYPES.OBJECT_ARRAY);
    result.addChild(new TreeNode("[0]"));
    result.addChild(new TreeNode("[1]"));
    result.findChild(["[0]"]).aliases = ["oarr-0"];
    result.findChild(["[1]"]).aliases = ["oarr-1"];
    expect(ctx.observables.saveProperty.value).toEqual(result);
  });

  it("should cancle changes", () => {
    ctx.component.onCancel();
    expect(ctx.observables.saveProperty.value).toBeUndefined();
    expect(ctx.observables.cancel.value).toBeUndefined();
  });

  it("should set value type", () => {
    ctx.component.data = {
      editMode: true,
      node: null,
      defaultTree: null,
      keyOptions: [
        {
          key: "key1",
          type: "type1"
        },
        {
          key: "key2",
          type: "type2"
        }
      ]
    };
    ctx.component.setValueTypeOption("key2");
    expect(ctx.component.valueType.value).toEqual("type2");
  });
});
