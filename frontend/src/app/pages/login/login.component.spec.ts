import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MaintenanceService } from '../../services/maintenance.service';
import { Store } from '@ngrx/store';
import { LoginComponent } from './login.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { MaterialComponentsModule } from '../../material-components/material-components.module';

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
    const storeStub = {
      pipe: () => ({
        pipe: () => ({
          subscribe: () => ({})
        })
      }),
      dispatch: () => ({})
    };
    TestBed.configureTestingModule({
      declarations: [
        LoginComponent,
        LoaderComponent,
      ],
      imports: [
        MaterialComponentsModule,
      ],
      schemas: [ NO_ERRORS_SCHEMA ],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: MaintenanceService, useValue: maintenanceServiceStub },
        { provide: Store, useValue: storeStub }
      ]
    });
    fixture = TestBed.createComponent(LoginComponent);
    comp = fixture.componentInstance;
  });

  it('can load instance', () => {
    expect(comp).toBeTruthy();
  });

  it('usernameTypeAhead defaults to: []', () => {
    expect(comp.usernameTypeAhead).toEqual([]);
  });

  describe('ngOnInit', () => {
    it('makes expected calls', () => {
      const routerStub: Router = fixture.debugElement.injector.get(Router);
      const storeStub: Store<any> = fixture.debugElement.injector.get(Store);
      spyOn(routerStub, 'navigate');
      spyOn(storeStub, 'pipe');
      spyOn(storeStub, 'dispatch');
      comp.ngOnInit();
      expect(routerStub.navigate).toHaveBeenCalled();
      expect(storeStub.pipe).toHaveBeenCalled();
      expect(storeStub.dispatch).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('makes expected calls', () => {
      const storeStub: Store<any> = fixture.debugElement.injector.get(Store);
      spyOn(storeStub, 'dispatch');
      comp.login();
      expect(storeStub.dispatch).toHaveBeenCalled();
    });
  });

});
