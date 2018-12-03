import { convertToParamMap } from '@angular/router';

import { Setup, assertDialogOpened, TestContext } from 'test/test-helper';

import { PROPERTY_VALUE_TYPES } from 'config';
import { TreeNode } from 'models/tree-node';
import { Configuration } from 'models/config-file';
import { Alert } from 'store/actions/common.actions';

import { PageLoadSuccess, ConfigurationChange } from 'store/actions/editor.actions';
import { LoadFilesSuccess, GetFileContentSuccess, SaveDraft, CommitChanges } from 'store/actions/backend.actions';

import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';

import { EditorComponent } from './editor.component';

describe('EditorComponent', () => {
  const setup = Setup(EditorComponent, false);

  const file = {
    applicationName: 'app1',
    fileName: 'sample.yaml',
    oid: '111111',
  };
  const applications = ['app1', 'app2', 'app3'];

  let ctx: TestContext<EditorComponent>;
  let dispatchSpy: jasmine.Spy;

  beforeEach(() => {
    ctx = setup();
    const backup = ctx.store.dispatch;
    dispatchSpy = spyOn(ctx.store, 'dispatch');
    dispatchSpy.and.callFake((action) => {
      if (action instanceof Alert || action instanceof ConfigurationChange) {
        return backup.apply(ctx.store, [action]);
      }
    })
  });

  it('should create EditorComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should init EditorComponent with edit file mode', () => {
    ctx.activatedRouteStub.snapshot = {
      data: {
        editMode: true,
        envFileMode: false
      },
      paramMap: convertToParamMap({
        appName: file.applicationName,
        fileName: file.fileName
      })
    };
    ctx.detectChanges();

    expect(ctx.component.filename.disabled).toBeTruthy();

    expect(dispatchSpy.calls.count()).toEqual(2);

    const pageLoad = dispatchSpy.calls.argsFor(0)[0].payload;
    expect(pageLoad).toEqual({ applicationName: file.applicationName, editMode: true });

    const getFileContentPayload = dispatchSpy.calls.argsFor(1)[0].payload;
    expect(getFileContentPayload).toEqual({fileName: file.fileName, applicationName: file.applicationName});
  });

  it('should init EditorComponent with edit file mode, file exists in backend state', () => {
    ctx.store.next(new LoadFilesSuccess({files: [file], applications }));
    ctx.activatedRouteStub.snapshot = {
      data: {
        editMode: true,
        envFileMode: false
      },
      paramMap: convertToParamMap({
        appName: file.applicationName,
        fileName: file.fileName
      })
    };
    ctx.detectChanges();

    expect(ctx.component.filename.disabled).toBeTruthy();

    expect(dispatchSpy.calls.count()).toEqual(2);

    const pageLoad = dispatchSpy.calls.argsFor(0)[0].payload;
    expect(pageLoad).toEqual({ applicationName: file.applicationName, editMode: true });

    const getFileContentPayload = dispatchSpy.calls.argsFor(1)[0].payload;
    expect(getFileContentPayload).toEqual(file);
  });

  it('should init EditorComponent with edit file mode, file content exists in backend state', () => {
    const fileWithContent = {
      ...file,
      originalConfig: new Configuration()
    }
    ctx.store.next(new LoadFilesSuccess({files: [fileWithContent], applications }));
    ctx.activatedRouteStub.snapshot = {
      data: {
        editMode: true,
        envFileMode: false
      },
      paramMap: convertToParamMap({
        appName: file.applicationName,
        fileName: file.fileName
      })
    };
    ctx.detectChanges();

    expect(ctx.component.filename.disabled).toBeTruthy();

    expect(dispatchSpy.calls.count()).toEqual(2);

    const pageLoad = dispatchSpy.calls.argsFor(0)[0].payload;
    expect(pageLoad).toEqual({ applicationName: file.applicationName, editMode: true });

    const getFileContentPayload = dispatchSpy.calls.argsFor(1)[0].payload;
    expect(getFileContentPayload).toEqual({file: fileWithContent});
  });

  async function initNewFileMode() {
    
    ctx.activatedRouteStub.snapshot = {
      data: {
        editMode: false,
        envFileMode: false
      },
      paramMap: convertToParamMap({
        appName: 'app1',
      })
    };
    ctx.detectChanges();

    expect(ctx.component.filename.enabled).toBeTruthy();
    expect(ctx.component.filename.value).toEqual('');
    expect(dispatchSpy.calls.count()).toEqual(2);

    const pageLoad = dispatchSpy.calls.argsFor(0)[0].payload;
    expect(pageLoad).toEqual({ applicationName: file.applicationName, editMode: false });

    const getFileContentPayload = dispatchSpy.calls.argsFor(1)[0].payload;
    const newFile = {
      file: {
        fileName: null,
        applicationName: 'app1',
        draftConfig: new Configuration(),
        modified: true
      },
      newlyCreated: true
    };
    expect(getFileContentPayload).toEqual(newFile);

    ctx.store.next(new LoadFilesSuccess({files: [file], applications }));
    ctx.store.next(new PageLoadSuccess({ environments: ['dev']}))
    ctx.store.next(new GetFileContentSuccess(newFile));

    ctx.detectChanges();
    await ctx.fixture.whenStable();
  }

  it('should init EditorComponent with new file mode', async () => {

    await initNewFileMode();
    const focusSpy = spyOn(ctx.component.fileNameInput, 'focus');

    await new Promise((resolve) => {
      setImmediate(async () => {
        await expect(focusSpy.calls.count()).toEqual(1)
        resolve();
      })
    });

    ctx.component.filename.setValue('');
    ctx.component.fileNameChange();
    expect(ctx.component.filename.valid).toBeFalsy();

    ctx.component.filename.setValue('new.yaml');
    ctx.component.fileNameChange();
    expect(ctx.component.filename.valid).toBeTruthy();
  });

  it('should not change to existing file name', async () => {
    await initNewFileMode();

    ctx.component.filename.setValue(file.fileName);
    ctx.component.fileNameChange();
    expect(ctx.component.filename.valid).toBeFalsy();
    expect(ctx.component.filename.hasError('alreadyExists')).toBeTruthy();
  });

  it('should not save draft if file name is invalid', async () => {
    await initNewFileMode();
    const focusSpy = spyOn(ctx.component.fileNameInput, 'focus');

    ctx.component.filename.setValue('');
    ctx.component.fileNameChange();
    expect(ctx.component.filename.valid).toBeFalsy();

    ctx.component.saveConfig();

    expect(focusSpy.calls.any()).toBeTruthy()
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof SaveDraft).toBeFalsy()
  })

  it('should not save draft if yaml config is invalid', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, '_{key1}_'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue('test.yaml');
    ctx.component.saveConfig();

    assertDialogOpened(AlertDialogComponent, {
      data: {message: `YAML validation failed:\nLoop variable reference: key1->key1`, alertType: 'error'},
    })
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof SaveDraft).toBeFalsy()
  })

  it('should save draft if file name and yaml config invalid', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'aaa'));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.STRING, 'bbb'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue('test.yaml');
    ctx.component.saveConfig();

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual(
      {
        file: {
          fileName: 'test.yaml',
          applicationName: 'app1',
          draftConfig: config,
          modified: true,
        },
        redirect: true
      }
    )
  })

  it('should not commit file if file name is invalid', async () => {
    await initNewFileMode();
    const focusSpy = spyOn(ctx.component.fileNameInput, 'focus');

    ctx.component.filename.setValue('');
    ctx.component.fileNameChange();
    expect(ctx.component.filename.valid).toBeFalsy();

    ctx.component.commitFile();

    expect(focusSpy.calls.any()).toBeTruthy()
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof CommitChanges).toBeFalsy()
  })

  it('should not commit file if yaml config is invalid', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, '_{key1}_'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue('test.yaml');
    ctx.component.saveConfig();

    assertDialogOpened(AlertDialogComponent, {
      data: {message: `YAML validation failed:\nLoop variable reference: key1->key1`, alertType: 'error'},
    })
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof CommitChanges).toBeFalsy()
  })

  it('should commit file if file name and yaml config invalid', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'aaa'));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.STRING, 'bbb'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.filename.setValue('test');
    ctx.component.commitFile();

    assertDialogOpened(CommitDialogComponent);
    ctx.dialogStub.output.next('some commit message');

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual(
      {
        files: [{
          fileName: 'test.yaml',
          applicationName: 'app1',
          draftConfig: config,
          modified: true,
        }],
        message: 'some commit message',
        fromEditor: true
      }
    )
  })

  it('should prevent to leave page', () => {
    const event: any = {};

    ctx.component.isPageDirty = false;
    ctx.component.onLeavePage(event);
    expect(event.returnValue).toBeFalsy();
    expect(ctx.component.canDeactivate()).toBeTruthy();

    ctx.component.isPageDirty = true;
    ctx.component.onLeavePage(event);
    expect(event.returnValue).toBeTruthy();

    ctx.component.canDeactivate();
    assertDialogOpened(ConfirmationDialogComponent, {
      data: {
        confirmationText: 'There may be unsaved changes. Are you sure you want to navigate?'
      }
    });
    ctx.dialogStub.output.next(true);
  });

  it('select a leaf node should work', () => {
    const node = new TreeNode('key', PROPERTY_VALUE_TYPES.STRING, 'value');

    ctx.component.onNodeSelected(node);

    expect(ctx.component.selectedNode).toEqual(node);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  })

  it('select an object node should work', () => {
    const node = new TreeNode('obj', PROPERTY_VALUE_TYPES.OBJECT);
    node.addChild(new TreeNode('key', PROPERTY_VALUE_TYPES.STRING, 'value'))

    ctx.component.onNodeSelected(node);

    expect(ctx.component.selectedNode).toEqual(node);
    expect(ctx.component.showAsCode).toEqual(true);
    expect(ctx.component.previewCode).toEqual('obj: !!map\n  key: !!str "value"');
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  })

  it('add/edit proprty should work', () => {
    const configProperty: any = {};

    ctx.component.onAddEditProperty(configProperty);

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(configProperty);

    ctx.component.onCancelAddEditProperty();

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  })

  it('open edit proprty should work', () => {
    const spy = jasmine.createSpyObj('', ['openEditPropertyDialog']);
    ctx.component.nestedConfig = spy;

    const node = new TreeNode('key');
    ctx.component.onNodeSelected(node);
    ctx.component.openEditPropertyDialog();

    expect(spy.openEditPropertyDialog.calls.mostRecent().args[0]).toEqual(node);
  })

  it('save proprty should work', () => {
    const spy = jasmine.createSpyObj('', ['saveAddEditProperty']);
    spy.saveAddEditProperty.and.returnValue(true);
    ctx.component.nestedConfig = spy;

    const node = new TreeNode('key');
    ctx.component.onSaveAddEditProperty(node);

    expect(spy.saveAddEditProperty.calls.mostRecent().args[0]).toEqual(node);
    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual(null);
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual(null);
    expect(ctx.component.currentConfigProperty).toEqual(null);
  })

  it('show compiled YAML should work', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, 'aaa'));
    config.default.addChild(new TreeNode('key2', PROPERTY_VALUE_TYPES.STRING, 'bbb'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.showCompiledYAML('dev');

    expect(ctx.component.selectedNode).toEqual(null);
    expect(ctx.component.showAsCode).toEqual(false);
    expect(ctx.component.previewCode).toEqual('dev: !!map\n  key1: !!str "aaa"\n  key2: !!str "bbb"');
    expect(ctx.component.showAsCompiledYAMLEnvironment).toEqual('dev');
    expect(ctx.component.currentConfigProperty).toEqual(null);
  })

  it('show compiled YAML should work', async () => {
    await initNewFileMode();

    const config = new Configuration();
    config.default.addChild(new TreeNode('key1', PROPERTY_VALUE_TYPES.STRING, '_{key1}_'));
    config.environments.addChild(new TreeNode('dev'))

    ctx.component.onConfigChange(config);

    ctx.component.showCompiledYAML('dev');

    assertDialogOpened(AlertDialogComponent, {
      data: {message: 'Loop variable reference: key1->key1', alertType: 'error'},
    })
  })

});
