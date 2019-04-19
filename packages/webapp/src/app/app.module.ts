/**
=========================================================================
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

import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { StoreModule } from "@ngrx/store";
import { StoreDevtoolsModule } from "@ngrx/store-devtools";
import { EffectsModule } from "@ngrx/effects";

// Common
import { CommonModule } from "common.module";

// app routing module
import { AppRoutingModule } from "./app-routing.module";

// main app component
import { AppComponent } from "./app.component";

// pages
import { LoginComponent } from "pages/login/login.component";
import { DashboardComponent } from "pages/dashboard/dashboard.component";
import { EditorPageComponent } from "pages/editor/editor.component";

// components
import { InitComponent } from "components/init/init.component";
import { LayoutComponent } from "components/layout/layout.component";
import { MainHeaderComponent } from "components/main-header/main-header.component";

import { CreateBranchDialogComponent } from "components/create-branch-dialog/create-branch-dialog.component";
import { CommitDialogComponent } from "components/commit-dialog/commit-dialog.component";
import { SelectAppDialogComponent } from "components/select-app-dialog/select-app-dialog.component";
import { ConflictDialogComponent } from "components/conflict-dialog/conflict-dialog.component";

import { reducers, metaReducers } from "store";
import { environment } from "../environments/environment";
import { AppEffects } from "store/affects/app.effects";
import { BackendEffects } from "store/affects/backend.effects";
import { DashboardEffects } from "store/affects/dashboard.effects";
import { AuthEffects } from "store/affects/auth.effects";
import { EditorEffects } from "store/affects/editor.effects";

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    InitComponent,
    DashboardComponent,
    LayoutComponent,
    MainHeaderComponent,
    EditorPageComponent,
    CreateBranchDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConflictDialogComponent
  ],
  imports: [
    HttpClientModule,
    AppRoutingModule,
    CommonModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
    EffectsModule.forRoot([
      AuthEffects,
      AppEffects,
      BackendEffects,
      DashboardEffects,
      EditorEffects
    ])
  ],
  entryComponents: [
    CreateBranchDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConflictDialogComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
