import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { Observable } from 'rxjs';
import { Store, StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { TestCtx, configureTestSuite, createTestContext } from 'ng-bullet';

import * as _ from 'lodash';

import { User } from '../../models/auth';
import { reducers } from '../../store';
import { LoginRedirect, Logout } from '../../store/actions/auth.actions';
import { AuthEffects } from '../../store/affects/auth.effects';
import { API_BASE_URL } from '../../services/http-helper.service';

import { LoginComponent } from './login.component';
import { MaterialComponentsModule } from '../../material-components/material-components.module';

describe('LoginComponent', () => {

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [
        LoginComponent,
      ],
      imports: [
        MaterialComponentsModule,
        HttpClientTestingModule,
        StoreModule.forRoot(reducers),
        EffectsModule.forRoot([AuthEffects])
      ],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: () => ({})
          }
        },
      ],
      schemas: [ NO_ERRORS_SCHEMA ],
    });
  });

  let ctx: TestCtx<LoginComponent>;
  let httpMock: HttpTestingController;
  let routerStub: Router;
  let store: Store<any>;

  beforeEach(async () => {
    ctx = await createTestContext(LoginComponent);
    httpMock = TestBed.get(HttpTestingController);

    routerStub = ctx.fixture.debugElement.injector.get(Router);

    store = ctx.fixture.debugElement.injector.get(Store);

    ctx.component.ngOnInit();
    await ctx.fixture.whenStable();
  });

  it('should show default repo', () => {

    const defaultRepo = {
      repositoryUrl: 'https://test.com/default-repo',
      branchName: 'admin'
    };

    httpMock.expectOne(`${API_BASE_URL}/defaultRepo`).flush(defaultRepo);

    expect(ctx.component.repositoryURL.value).toEqual(defaultRepo.repositoryUrl);
    expect(ctx.component.branchName.value).toEqual(defaultRepo.branchName);
  });

  it('should show login error propery', () => {
    expect(ctx.component.loginError).toBeNull();

    ctx.component.username.setValue('test-user');
    ctx.component.password.setValue('test-pass');
    ctx.component.repositoryURL.setValue('https://test.com/default-repo');
    ctx.component.branchName.setValue('admin');

    ctx.component.login();
    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(
      {statusCode: 401}, { status: 401, statusText: 'Unauthorized'});
    expect(ctx.component.password.hasError('invalid')).toBeTruthy();
    ctx.component.password.setErrors(null);

    ctx.component.login();
    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(
      {statusCode: 403}, { status: 403, statusText: 'Forbidden'});
    expect(ctx.component.repositoryURL.hasError('forbidden')).toBeTruthy();
    ctx.component.repositoryURL.setErrors(null);

    ctx.component.login();
    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(
      {message: 'Repository not found'}, { status: 404, statusText: 'Not Found'});
    expect(ctx.component.repositoryURL.hasError('notFound')).toBeTruthy();
    ctx.component.repositoryURL.setErrors(null);

    ctx.component.login();
    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(
      {message: 'Branch not found'}, { status: 404, statusText: 'Not Found'});
    expect(ctx.component.branchName.hasError('notFound')).toBeTruthy();
    ctx.component.branchName.setErrors(null);

    ctx.component.login();
    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(
      {statusCode: 500}, { status: 500, statusText: 'Internal Server Error'});
    expect(ctx.component.loginError).toEqual('Login failed');

    ctx.component.inputChange();
    expect(ctx.component.loginError).toBeNull();
  });

  function lastValue(observable: Observable<any>) {

    let result;
    observable.subscribe((_result) => {
      result = _result;
    });
    return  () => {
      return result;
    };
  }

  it('should show auto complete prompt for username', async () => {
    const filteredUsernames = lastValue(ctx.component.filteredUsernames);

    ctx.component.username.setValue('m');
    await new Promise(resolve => setTimeout(resolve, 250)); // wait for debouce time

    const usernames = [
      'Mike',
      'Muller',
    ];
    httpMock.expectOne(`${API_BASE_URL}/userTypeAhead?prefix=m`).flush(usernames);

    expect(await filteredUsernames()).toEqual(['Mike', 'Muller']);

    ctx.component.username.setValue('mi');
    await new Promise(resolve => setTimeout(resolve, 250)); // wait for debouce time

    expect(await filteredUsernames()).toEqual(['Mike']);
  });

  function doLogin() {
    const user: User = {
      username: 'test-user',
      repositoryUrl: 'https://test.com/repo',
      branchName: 'admin',
      token: 'test-token',
      repoName: 'test-repo',
      validUntil: new Date(Date.now() + 1000000).toISOString(),
      envFileName: 'environments.yaml',
    };

    ctx.component.username.setValue(user.username);
    ctx.component.password.setValue('test-pass');
    ctx.component.repositoryURL.setValue(user.repositoryUrl);
    ctx.component.branchName.setValue(user.branchName);
    ctx.component.login();

    httpMock.expectOne(`${API_BASE_URL}/accessRepo`).flush(_.pick(user, ['repoName', 'token', 'validUntil', 'envFileName']));
  }

  it('login function should work', () => {

    spyOn(routerStub, 'navigate');

    doLogin();
    expect(routerStub.navigate).toHaveBeenCalledWith([ '/dashboard' ]);

    // logout
    store.dispatch(new Logout());

    // set the redirect url after login
    store.dispatch(new LoginRedirect({ redirectUrl: '/redirect-to-page'}));

    doLogin();
    expect(routerStub.navigate).toHaveBeenCalledWith([ '/redirect-to-page' ]);
  });

  it('input should trigger auto complete change', () => {
    ctx.fixture.detectChanges(); // Need change detection for the auto complete trigger

    ctx.component.username.setValue('');
    expect(ctx.component.username.valid).toBeFalsy();

    const input = { value: 'test-user' };

    const event = new KeyboardEvent('click');
    spyOnProperty(event, 'currentTarget', 'get').and.returnValue(input);
    ctx.component.onInput(event);

    expect(ctx.component.username.value).toEqual(input.value);
    expect(ctx.component.username.valid).toBeTruthy();
  });
});
