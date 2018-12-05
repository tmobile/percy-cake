import { Router, ActivatedRoute } from '@angular/router';
import { Type, NO_ERRORS_SCHEMA, Component } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { HttpClient } from '@angular/common/http';
import { Observable, isObservable, BehaviorSubject, Subscription } from 'rxjs';
import { Store, StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import yaml from 'highlight.js/lib/languages/yaml';
import * as _ from 'lodash';

import { TestBed } from '@angular/core/testing';
import { TestCtx, createTestContext, configureTestSuite } from 'ng-bullet';

import { MaterialComponentsModule } from 'material-components/material-components.module';

import { User } from 'models/auth';
import { reducers, metaReducers, AppState } from 'store';
import { AppEffects } from 'store/affects/app.effects';
import { AuthEffects } from 'store/affects/auth.effects';
import { BackendEffects } from 'store/affects/backend.effects';
import { EditorEffects } from 'store/affects/editor.effects';
import { DashboardEffects } from 'store/affects/dashboard.effects';

import { UtilService } from 'services/util.service';
import { HighlightDirective } from 'directives/highlight.directive';

import { percyConfig } from 'config';

declare var beforeEach: (any) => any;
declare var afterEach: (any) => any;

const percyTestConfig = require('../../percy.conf.test.json');

// Inject test config
_.assign(percyConfig, percyTestConfig);

export function getVariable(key) {
  return `${percyConfig.variableSubstitutePrefix}${key}${percyConfig.variableSubstituteSuffix}`;
}

const httpSpy = jasmine.createSpyObj('httpSpy', ['get']);
httpSpy.get.and.returnValue(percyConfig);
export const utilService = new UtilService(httpSpy);

export const TestUser: User = {
  username: 'test-user',
  repositoryUrl: 'https://bitbucket.org/tc/repo',
  branchName: 'admin',
  token: 'test-token',
  repoName: 'tc/repo',
  repoFolder: 'test-user!tc%2Frepo!admin'
};

@Component({
  selector: 'app-test-store-host',
  template: '<div></div>',
})
export class StoreTestComponent {
  constructor(public store: Store<AppState>) { }
}

const DialogStub = {
  input: new BehaviorSubject(undefined),
  output: new BehaviorSubject(undefined)
};
const RouterStub = new BehaviorSubject<string[]>(undefined);

export class TestContext<T> extends TestCtx<T> {

  readonly routerStub = RouterStub;
  readonly dialogStub = DialogStub;
  readonly activatedRouteStub: any;
  readonly store: Store<AppState>;
  readonly observables: { [name: string]: BehaviorSubject<any> } = {};

  constructor(testCtx: TestCtx<T>) {
    super(testCtx.fixture);
    this.store = this.resolve(Store);
    this.activatedRouteStub = this.resolve(ActivatedRoute);
  }

  authState() {
    return this.observables.store.value.auth;
  }

  backendState() {
    return this.observables.store.value.backend;
  }

  dashboarState() {
    return this.observables.store.value.dashboard;
  }

  editorState() {
    return this.observables.store.value.editor;
  }
}

class ValueOfObservable<T> extends BehaviorSubject<T> {
  subscription: Subscription;

  constructor(observable: Observable<T>) {
    super(undefined);
    this.subscription = observable.subscribe((_result) => {
      this.next(_result);
    });
  }

  unsubscribe() {
    this.subscription.unsubscribe();
  }
}

export const assertDialogOpened = <T>(dialogType: Type<T>, options?) => {
  expect(DialogStub.input.value).toEqual({ dialogType, options });
};

export const Setup = <T>(componentType: Type<T>, triggerLifecyle: boolean = true) => {

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        MaterialComponentsModule,
        StoreModule.forRoot(reducers, { metaReducers }),
        EffectsModule.forRoot([AppEffects, AuthEffects, BackendEffects, DashboardEffects, EditorEffects])
      ],
      declarations: [
        componentType,
        HighlightDirective
      ],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: (paths) => {
              RouterStub.next(paths);
            }
          }
        },
        {
          provide: HttpClient,
          useValue: httpSpy
        },
        {
          provide: MatDialog, useValue: {
            open(dialogType, options) {
              DialogStub.input.next({ dialogType, options });
              return {
                afterClosed: () => {
                  DialogStub.output = new BehaviorSubject(undefined);
                  return DialogStub.output;
                }
              };
            }
          },
        },
        {
          provide: MatDialogRef, useValue: {
            close: (value) => {
              DialogStub.output.next(value);
            }
          },
        },
        {
          provide: ActivatedRoute, useValue: {},
        },
        {
          provide: MAT_DIALOG_DATA, useValue: {},
        },
        {
          provide: HIGHLIGHT_OPTIONS, useValue: { languages: () => [{ name: 'yaml', func: yaml }] }
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  let ctx: TestContext<T>;

  beforeEach(async () => {
    // Reset the stub values before each test
    RouterStub.next(undefined);
    DialogStub.output.next(undefined);
    DialogStub.input.next(undefined);

    // Create component and the test context
    ctx = new TestContext(createTestContext(componentType));

    // For best practice, the component's observables should be
    // created directly as component's instance properties
    // (instead of created during ngOnInit/ngOnChanges)
    _.keys(ctx.component).forEach(key => {
      const obs = ctx.component[key];
      if (isObservable(obs)) {
        ctx.observables[key] = new ValueOfObservable(obs);
      }
    });

    if (triggerLifecyle) {
      ctx.fixture.detectChanges(); // This will trigger lifecyle ngOnInit
    }

    await ctx.fixture.whenStable();
  });

  afterEach(() => {
    _.keys(ctx.observables).forEach(key => {
      ctx.observables[key].unsubscribe();
    });
  });

  return () => ctx;
};
