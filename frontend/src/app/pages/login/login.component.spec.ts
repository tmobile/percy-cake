import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';

import { reducers } from '../../store';

import { MaintenanceService } from '../../services/maintenance.service';
import { LoginComponent } from './login.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { MaterialComponentsModule } from '../../material-components/material-components.module';
import { LoginSuccess } from '../../store/actions/auth.actions';
import { User } from '../../models/auth';

describe('LoginComponent', () => {
  let comp: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(() => {
    const routerStub = {
      navigate: () => ({})
    };
    const maintenanceServiceStub = {
      getUserTypeAhead: () => ({
        pipe: () => ({})
      })
    };

    TestBed.configureTestingModule({
      declarations: [
        LoginComponent,
        LoaderComponent,
      ],
      imports: [
        MaterialComponentsModule,
        StoreModule.forRoot(reducers)
      ],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: MaintenanceService, useValue: maintenanceServiceStub },
      ],
      schemas: [ NO_ERRORS_SCHEMA ],
    });

    fixture = TestBed.createComponent(LoginComponent);
    comp = fixture.componentInstance;
    comp.ngOnInit();
  });

  // it('can load instance', () => {
  //   expect(comp).toBeTruthy();
  // });

  // it('usernameTypeAhead defaults to: []', () => {
  //   expect(comp.usernameTypeAhead).toEqual([]);
  // });

  describe('ngOnInit', () => {
    it('should redirect to dashboard page when logged in', () => {

      const routerStub: Router = fixture.debugElement.injector.get(Router);
      const store: Store<any> = fixture.debugElement.injector.get(Store);
      const user: User = {
        username: 'test-user',
        token: 'test-token',
        repoName: 'test-repo',
        validUntil: new Date(Date.now() + 1000000).toISOString(),
        envFileName: 'environments.yaml',
        repositoryUrl: 'https://test.com/repo',
        branchName: 'admin'
      };
      store.dispatch(new LoginSuccess(user));

      spyOn(routerStub, 'navigate');
      fixture.detectChanges();
      expect(routerStub.navigate).toHaveBeenCalledWith([ '/dashboard' ]);
    });
  });

  // describe('login', () => {
  //   it('makes expected calls', () => {
  //     const storeStub: Store<any> = fixture.debugElement.injector.get(Store);
  //     spyOn(storeStub, 'dispatch');
  //     comp.login();
  //     expect(storeStub.dispatch).toHaveBeenCalled();
  //   });
  // });

});
