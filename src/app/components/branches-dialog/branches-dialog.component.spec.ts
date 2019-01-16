import { Setup, TestContext, TestUser } from 'test/test-helper';

import { BranchesDialogComponent } from './branches-dialog.component';
import { Principal } from 'models/auth';
import { FileManagementService } from 'services/file-management.service';
import { percyConfig } from 'config';

describe('BranchesDialogComponent', () => {

  const setup = Setup(BranchesDialogComponent, false);
  const branches = [TestUser.branchName, 'branch1', 'branch2'];

  let fileService: FileManagementService;
  let ctx: TestContext<BranchesDialogComponent>;

  beforeEach(async () => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, 'listBranches').and.returnValue(branches);

    // Init component
    const principal: Principal = {
      user: { ...TestUser },
      repoMetadata: { ...TestUser, version: '1.0', commitBaseSHA: {} }
    };
    const data = {
      principal,
    };
    ctx.component.data = data;
    ctx.detectChanges();

    await ctx.fixture.whenStable();
  });

  it('should create BranchesDialogComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should init component', async () => {
    expect(ctx.component.branches).toEqual(branches);
    expect(ctx.component.currentBranchName).toEqual(TestUser.branchName);
    expect(ctx.component.branchName.value).toEqual(TestUser.branchName);
    expect(ctx.component.branchName.enabled).toBeTruthy();
    expect(ctx.component.newBranchName.enabled).toBeFalsy();
  });

  it('switch to same branch should have no effect', async () => {
    ctx.component.checkout();
    expect(ctx.dialogStub.output.value).toBeUndefined();
  });

  it('switch to different branch should be successful', async () => {
    ctx.component.branchName.setValue('branch1');
    ctx.component.checkout();
    expect(ctx.dialogStub.output.value).toEqual({ type: 'switch', branch: 'branch1' });
  });

  it('new branch name should be required', async () => {
    ctx.component.actionType = 'create';
    ctx.component.actionTypeChange();
    ctx.component.newBranchName.setValue('');
    ctx.component.checkout();
    expect(ctx.component.newBranchName.hasError('required')).toBeTruthy();
  });

  it('new branch name should follow valid pattern', async () => {
    ctx.component.actionType = 'create';
    ctx.component.actionTypeChange();
    ctx.component.newBranchName.setValue('@#*U)!(');
    ctx.component.checkout();
    expect(ctx.component.newBranchName.hasError('pattern')).toBeTruthy();
  });

  it('new branch name should not be duplicate', async () => {
    ctx.component.actionType = 'create';
    ctx.component.actionTypeChange();
    ctx.component.newBranchName.setValue(TestUser.branchName);
    ctx.component.checkout();
    expect(ctx.component.newBranchName.hasError('duplicate')).toBeTruthy();
  });

  it('new branch name should not be locked', async () => {
    ctx.component.actionType = 'create';
    ctx.component.actionTypeChange();
    ctx.component.newBranchName.setValue(percyConfig.lockedBranches[0]);
    ctx.component.checkout();
    expect(ctx.component.newBranchName.hasError('locked')).toBeTruthy();
  });

  it('create new branch should be successful', async () => {
    ctx.component.actionType = 'create';
    ctx.component.actionTypeChange();
    ctx.component.newBranchName.setValue('new-branch');
    ctx.component.checkout();
    expect(ctx.dialogStub.output.value).toEqual({ type: 'create', branch: 'new-branch' });
  });
});
