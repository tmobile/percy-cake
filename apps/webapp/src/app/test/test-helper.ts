/**
========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { Router, ActivatedRoute } from "@angular/router";
import { Type, NO_ERRORS_SCHEMA, Component } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { HttpClient } from "@angular/common/http";
import { Observable, isObservable, BehaviorSubject, Subscription, of } from "rxjs";
import { Store, StoreModule } from "@ngrx/store";
import { EffectsModule } from "@ngrx/effects";
import { HIGHLIGHT_OPTIONS } from "ngx-highlightjs";
import * as _ from "lodash";

import { TestBed } from "@angular/core/testing";
import { TestCtx, createTestContext, configureTestSuite } from "ng-bullet";

import { MaterialComponentsModule } from "material-components/material-components.module";

import { User } from "models/auth";
import { reducers, metaReducers, AppState } from "store";
import { AppEffects } from "store/affects/app.effects";
import { AuthEffects } from "store/affects/auth.effects";
import { BackendEffects } from "store/affects/backend.effects";
import { EditorEffects } from "store/affects/editor.effects";
import { DashboardEffects } from "store/affects/dashboard.effects";

import { UtilService } from "services/util.service";
import { HighlightDirective } from "directives/highlight.directive";

import { percyConfig } from "config";
import { LogoutSuccess } from "store/actions/auth.actions";

declare let beforeEach: (any) => any;
declare let afterEach: (any) => any;

const percyTestConfig = require("../../percy.conf.test.json");

const highlightjs = { default: require("highlight.js/lib/core") };
const yamlLang = { default: require("highlight.js/lib/languages/yaml") };
const jsonLang = { default: require("highlight.js/lib/languages/json") };

// Inject test config
_.assign(percyConfig, percyTestConfig);

const httpSpy = jasmine.createSpyObj("httpSpy", ["get"]);
(httpSpy.get as jasmine.Spy).and.callFake((url: string) => {
  if (url === "percy.conf.json") {
    return of(percyConfig);
  }
  return of(url);
});
const ngZoneSpy = jasmine.createSpyObj("ngZoneSpy", ["run"]);
export const utilService = new UtilService(httpSpy, ngZoneSpy);

export const TEST_USER: User = {
  username: "test-user",
  repositoryUrl: "https://bitbucket.org/tc/repo",
  branchName: "admin",
  token: "test-token",
  repoName: "tc/repo",
  repoFolder: "test-user!tc%2Frepo"
};

@Component({
  selector: "app-test-store-host",
  template: "<div></div>",
})
export class StoreTestComponent {
  constructor(public store: Store<AppState>) { }
}

const DIALOG_STUB = {
  input: new BehaviorSubject(undefined),
  output: new BehaviorSubject(undefined)
};
const ROUTER_STUB = new BehaviorSubject<string[]>(undefined);

export class TestContext<T> extends TestCtx<T> {

  readonly routerStub = ROUTER_STUB;
  readonly dialogStub = DIALOG_STUB;
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

  async asyncWait() {
    await Promise.resolve();
    await this.fixture.whenStable();
    await this.fixture.whenRenderingDone();
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
  expect(DIALOG_STUB.input.value).toEqual({ dialogType, options });
};

export const SETUP = <T>(componentType: Type<T>, triggerLifecyle: boolean = true) => {

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        MaterialComponentsModule,
        StoreModule.forRoot(reducers, {
            metaReducers,
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false
            }
        }),
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
              ROUTER_STUB.next(paths);
            }
          }
        },
        {
          provide: HttpClient,
          useValue: httpSpy
        },
        {
          provide: MatDialog, useValue: {
            open: (dialogType, options) => {
              DIALOG_STUB.input.next({ dialogType, options });
              return {
                afterClosed: () => {
                  DIALOG_STUB.output = new BehaviorSubject(undefined);
                  return DIALOG_STUB.output;
                }
              };
            }
          },
        },
        {
          provide: MatDialogRef, useValue: {
            close: (value) => {
              DIALOG_STUB.output.next(value);
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
          provide: HIGHLIGHT_OPTIONS,
          useValue: {
            coreLibraryLoader: () => of(highlightjs),
            languages: {
              yaml: () => of(yamlLang),
              json: () => of(jsonLang)
            }
          }
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  let ctx: TestContext<T>;

  beforeEach(async () => {

    // Create component and the test context
    ctx = new TestContext(createTestContext(componentType));
    ctx.store.next(new LogoutSuccess());

    // Reset the stub values before each test
    ROUTER_STUB.next(undefined);
    DIALOG_STUB.output = new BehaviorSubject(undefined);
    DIALOG_STUB.input = new BehaviorSubject(undefined);

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
