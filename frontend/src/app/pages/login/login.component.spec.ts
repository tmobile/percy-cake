import * as _ from 'lodash';

import { LoginRedirect, Logout } from 'store/actions/auth.actions';
import { API_BASE_URL } from 'services/http-helper.service';
import { TestUser, Setup } from 'test/test-helper';

import { LoginComponent } from './login.component';


describe('LoginComponent', () => {

  const ctx = Setup(LoginComponent);

  it('should create LoginComponent', () => {
    expect(ctx().component).toBeTruthy();
  });

  it('should show default repo', () => {

    const defaultRepo = {
      repositoryUrl: 'https://test.com/default-repo',
      branchName: 'admin'
    };

    ctx().httpMock.expectOne(`${API_BASE_URL}/defaultRepo`).flush(defaultRepo);

    expect(ctx().component.repositoryURL.value).toEqual(defaultRepo.repositoryUrl);
    expect(ctx().component.branchName.value).toEqual(defaultRepo.branchName);
  });

  it('should show auto complete prompt for username', async () => {
    ctx().component.username.setValue('m');
    await new Promise(resolve => setTimeout(resolve, 250)); // wait for debouce time

    const usernames = [
      'Mike',
      'Muller',
    ];
    ctx().httpMock.expectOne(`${API_BASE_URL}/userTypeAhead?prefix=m`).flush(usernames);

    expect(ctx().observables.filteredUsernames.value).toEqual(['Mike', 'Muller']);

    ctx().component.username.setValue('mi');
    await new Promise(resolve => setTimeout(resolve, 250)); // wait for debouce time

    expect(ctx().observables.filteredUsernames.value).toEqual(['Mike']);
  });

  it('input should trigger auto complete change', () => {
    ctx().component.username.setValue('');
    expect(ctx().component.username.valid).toBeFalsy();

    const input = { value: 'test-user' };

    const event = new KeyboardEvent('click');
    spyOnProperty(event, 'currentTarget', 'get').and.returnValue(input);
    ctx().component.onInput(event);

    expect(ctx().component.username.value).toEqual(input.value);
    expect(ctx().component.username.valid).toBeTruthy();
  });

  function doLogin(result, opts?) {

    ctx().component.username.setValue(TestUser.username);
    ctx().component.username.setErrors(null);
    ctx().component.password.setValue('test-pass');
    ctx().component.password.setErrors(null);
    ctx().component.repositoryURL.setValue(TestUser.repositoryUrl);
    ctx().component.repositoryURL.setErrors(null);
    ctx().component.branchName.setValue(TestUser.branchName);
    ctx().component.branchName.setErrors(null);
    ctx().component.login();

    expect(ctx().observables.formProcessing.value).toBeTruthy();
    ctx().httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(result, opts);
    expect(ctx().observables.formProcessing.value).toBeFalsy();
  }

  it('login function should work', () => {
    doLogin(_.pick(TestUser, ['repoName', 'token', 'validUntil', 'envFileName']));
    expect(ctx().routerStub.value).toEqual([ '/dashboard' ]);

    // logout
    ctx().store.dispatch(new Logout());

    // set the redirect url after login
    ctx().store.dispatch(new LoginRedirect({ redirectUrl: '/redirect-to-page'}));

    doLogin(_.pick(TestUser, ['repoName', 'token', 'validUntil', 'envFileName']));
    expect(ctx().routerStub.value).toEqual([ '/redirect-to-page' ]);
  });

  it('should show login error propery', () => {
    expect(ctx().component.loginError).toBeNull();

    doLogin({statusCode: 401}, { status: 401, statusText: 'Unauthorized'});
    expect(ctx().component.password.hasError('invalid')).toBeTruthy();

    doLogin({statusCode: 403}, { status: 403, statusText: 'Forbidden'});
    expect(ctx().component.repositoryURL.hasError('forbidden')).toBeTruthy();

    doLogin({message: 'Repository not found'}, { status: 404, statusText: 'Not Found'});
    expect(ctx().component.repositoryURL.hasError('notFound')).toBeTruthy();

    doLogin({message: 'Branch not found'}, { status: 404, statusText: 'Not Found'});
    expect(ctx().component.branchName.hasError('notFound')).toBeTruthy();

    doLogin({statusCode: 500}, { status: 500, statusText: 'Internal Server Error'});
    expect(ctx().component.loginError).toEqual('Login failed');

    ctx().component.inputChange();
    expect(ctx().component.loginError).toBeNull();
  });
});
