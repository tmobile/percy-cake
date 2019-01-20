import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { InlineSVGModule } from 'ng-inline-svg';

// Common
import { CommonModule } from 'common.module';

// app routing module
import { AppRoutingModule } from './app-routing.module';

// main app component
import { AppComponent } from './app.component';

// pages
import { LoginComponent } from 'pages/login/login.component';
import { DashboardComponent } from 'pages/dashboard/dashboard.component';
import { EditorPageComponent } from 'pages/editor/editor.component';
import { ElectronAppComponent } from 'pages/electron/electron.component';

// components
import { InitComponent } from 'components/init/init.component';
import { LayoutComponent } from 'components/layout/layout.component';
import { MainHeaderComponent } from 'components/main-header/main-header.component';

import { CreateBranchDialogComponent } from 'components/create-branch-dialog/create-branch-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { SelectAppDialogComponent } from 'components/select-app-dialog/select-app-dialog.component';
import { ConflictDialogComponent } from 'components/conflict-dialog/conflict-dialog.component';
import { PreferencesComponent } from 'components/preferences/preferences.component';

import { StoreModule } from '@ngrx/store';
import { reducers, metaReducers } from 'store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { EffectsModule } from '@ngrx/effects';
import { AppEffects } from 'store/affects/app.effects';
import { BackendEffects } from 'store/affects/backend.effects';
import { DashboardEffects } from 'store/affects/dashboard.effects';
import { AuthEffects } from 'store/affects/auth.effects';
import { EditorEffects } from 'store/affects/editor.effects';


@NgModule({
  declarations: [
    AppComponent,
    ElectronAppComponent,
    LoginComponent,
    InitComponent,
    DashboardComponent,
    LayoutComponent,
    MainHeaderComponent,
    EditorPageComponent,
    CreateBranchDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConflictDialogComponent,
    PreferencesComponent,
  ],
  imports: [
    HttpClientModule,
    AppRoutingModule,
    CommonModule,
    InlineSVGModule.forRoot(),
    StoreModule.forRoot(reducers, { metaReducers }),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
    EffectsModule.forRoot([AuthEffects, AppEffects, BackendEffects, DashboardEffects, EditorEffects])
  ],
  entryComponents: [
    CreateBranchDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConflictDialogComponent,
    PreferencesComponent,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
