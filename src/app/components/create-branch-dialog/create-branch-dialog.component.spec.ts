import { Setup, TestContext, TestUser } from 'test/test-helper';

import { CreateBranchDialogComponent } from './create-branch-dialog.component';
import { FileManagementService } from 'services/file-management.service';
import { percyConfig } from 'config';

describe('CreateBranchDialogComponent', () => {

  const setup = Setup(CreateBranchDialogComponent, false);
  const branches = [TestUser.branchName, 'branch1', 'branch2'];

  let fileService: FileManagementService;
  let ctx: TestContext<CreateBranchDialogComponent>;

  beforeEach(async () => {
    ctx = setup();
    fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, 'listBranches').and.returnValue(branches);

    const data = {
      branches,
    };
    ctx.component.data = data;
    ctx.detectChanges();

    await ctx.fixture.whenStable();
  });

  it('should create CreateBranchDialogComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  // it('switch to different branch should be successful', async () => {
  //   ctx.component.branchName.setValue('branch1');
  //   ctx.component.checkout();
  //   expect(ctx.dialogStub.output.value).toEqual({ type: 'switch', branch: 'branch1' });
  // });

  it('new branch name should be required', async () => {
    ctx.component.newBranchName.setValue('');
    ctx.component.createBranch();
    expect(ctx.component.newBranchName.hasError('required')).toBeTruthy();
  });

  it('new branch name should follow valid pattern', async () => {
    ctx.component.newBranchName.setValue('@#*U)!(');
    ctx.component.createBranch();
    expect(ctx.component.newBranchName.hasError('pattern')).toBeTruthy();
  });

  it('new branch name should not be duplicate', async () => {
    ctx.component.newBranchName.setValue(TestUser.branchName);
    ctx.component.createBranch();
    expect(ctx.component.newBranchName.hasError('duplicate')).toBeTruthy();
  });

  it('new branch name should not be locked', async () => {
    ctx.component.newBranchName.setValue(percyConfig.lockedBranches[0]);
    ctx.component.createBranch();
    expect(ctx.component.newBranchName.hasError('locked')).toBeTruthy();
  });

  it('create new branch should be successful', async () => {
    ctx.component.newBranchName.setValue('new-branch');
    ctx.component.createBranch();
    expect(ctx.dialogStub.output.value).toEqual('new-branch');
  });
});
