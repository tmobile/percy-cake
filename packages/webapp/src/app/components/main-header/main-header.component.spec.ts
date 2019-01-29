import { Setup, TestContext, assertDialogOpened, TestUser } from 'test/test-helper';
import * as AuthActions from 'store/actions/auth.actions';
import { Initialized } from 'store/actions/backend.actions';
import { Principal } from 'models/auth';
import { FileManagementService } from 'services/file-management.service';
import { CreateBranchDialogComponent } from 'components/create-branch-dialog/create-branch-dialog.component';
import { MainHeaderComponent } from './main-header.component';

describe('MainHeaderComponent', () => {

  const setup = Setup(MainHeaderComponent, false);
  const branches = [TestUser.branchName, 'branch1', 'branch2'];

  let fileService: FileManagementService;
  let ctx: TestContext<MainHeaderComponent>;
  let dispatchSpy: jasmine.Spy;

  beforeEach(async () => {
    ctx = setup();
    dispatchSpy = spyOn(ctx.store, 'dispatch');

    fileService = ctx.resolve(FileManagementService);
    spyOn(fileService, 'listBranches').and.returnValue(branches);
    spyOn(fileService, 'getFiles').and.returnValue({ files: [], applications: [] });

    const principal: Principal = {
      user: { ...TestUser },
      repoMetadata: { ...TestUser, version: '1.0', commitBaseSHA: {} }
    };
    ctx.store.next(new Initialized({ principal }));

    ctx.component.getBranches();

    await ctx.fixture.whenStable();
  });

  it('should create MainHeaderComponent', () => {
    expect(ctx.component).toBeTruthy();
  });

  it('should get branches and current branch name', async () => {
    expect(ctx.component.branches).toEqual(branches);
    expect(ctx.component.currentBranchName).toEqual(TestUser.branchName);
  });

  it('should switch branch successfully', () => {
    ctx.component.checkoutBranch('branch2');
    const data = { type: 'switch', branch: 'branch2' };

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual(data);
  });

  it('should create branch successfully', () => {
    ctx.component.createBranch();
    assertDialogOpened(CreateBranchDialogComponent, { data: { branches } });
    ctx.dialogStub.output.next('new-branch');

    expect(dispatchSpy.calls.mostRecent().args[0].payload).toEqual({ type: 'create', branch: 'new-branch'});
  });

  it('should logout successfully', () => {
    ctx.component.logout();
    expect(dispatchSpy.calls.mostRecent().args[0] instanceof AuthActions.Logout).toBeTruthy();
  });
});
