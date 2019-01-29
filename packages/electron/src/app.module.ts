import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

// Common
import { CommonModule } from 'common.module';

// pages
import { LoginComponent } from 'pages/login/login.component';
import { DashboardComponent } from 'pages/dashboard/dashboard.component';
import { EditorPageComponent } from 'pages/editor/editor.component';

// components
import { InitComponent } from 'components/init/init.component';
import { LayoutComponent } from 'components/layout/layout.component';
import { MainHeaderComponent } from 'components/main-header/main-header.component';

import { CreateBranchDialogComponent } from 'components/create-branch-dialog/create-branch-dialog.component';
import { CommitDialogComponent } from 'components/commit-dialog/commit-dialog.component';
import { SelectAppDialogComponent } from 'components/select-app-dialog/select-app-dialog.component';
import { ConflictDialogComponent } from 'components/conflict-dialog/conflict-dialog.component';

import { reducers, metaReducers } from 'store';
import { AppEffects } from 'store/affects/app.effects';
import { BackendEffects } from 'store/affects/backend.effects';
import { DashboardEffects } from 'store/affects/dashboard.effects';
import { AuthEffects } from 'store/affects/auth.effects';
import { EditorEffects } from 'store/affects/editor.effects';

// electron specfic components
import { ElectronAppComponent } from './app.component';
import { ElectronAppRoutingModule } from './app-routing.module';
import { ElectronPageComponent } from './components/electron/electron.component';
import { PreferencesComponent } from './components/preferences/preferences.component';

@NgModule({
  declarations: [
    ElectronAppComponent,
    ElectronPageComponent,
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
    ElectronAppRoutingModule,
    CommonModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([AuthEffects, AppEffects, BackendEffects, DashboardEffects, EditorEffects])
  ],
  entryComponents: [
    CreateBranchDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConflictDialogComponent,
    PreferencesComponent,
  ],
  bootstrap: [ElectronAppComponent]
})
export class ElectronAppModule { }
