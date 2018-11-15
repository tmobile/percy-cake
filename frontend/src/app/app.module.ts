import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { HighlightModule } from 'ngx-highlightjs';

// angular material components
import { MaterialComponentsModule } from './material-components/material-components.module';

// app routing module
import { AppRoutingModule } from './app-routing.module';

// services
import { UtilService } from './services/util.service';
import { HttpHelperService } from './services/http-helper.service';
import { AuthGuardService } from './services/auth-guard.service';
import { EntryGuardService } from './services/entry-guard.service';
import { FileManagementService } from './services/file-management.service';

// main app component
import { AppComponent } from './app.component';

// pages
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EditorComponent } from './pages/editor/editor.component';

// components
import { AppEntryComponent } from './components/app-entry/app-entry.component';
import { LayoutComponent } from './components/layout/layout.component';
import { MainHeaderComponent } from './components/main-header/main-header.component';
import { LoaderComponent } from './components/loader/loader.component';
import { AddEditPropertyDialogComponent } from './components/add-edit-property-dialog/add-edit-property-dialog.component';
import { NestedConfigViewComponent } from './components/nested-config-view/nested-config-view.component';
import { ConfirmationDialogComponent } from './components/confirmation-dialog/confirmation-dialog.component';
import { CommitDialogComponent } from './components/commit-dialog/commit-dialog.component';
import { SelectAppDialogComponent } from './components/select-app-dialog/select-app-dialog.component';
import { AlertDialogComponent } from './components/alert-dialog/alert-dialog.component';
import { ConflictDialogComponent } from './components/conflict-dialog/conflict-dialog.component';
import { CanDeactivateGuard } from './services/can-deactivate-guard.service';
import { StoreModule } from '@ngrx/store';
import { reducers, metaReducers } from './store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { EffectsModule } from '@ngrx/effects';
import { AppEffects } from './store/affects/app.effects';
import { BackendEffects } from './store/affects/backend.effects';
import { DashboardEffects } from './store/affects/dashboard.effects';
import { AuthEffects } from './store/affects/auth.effects';
import { ConfigFileAddEditEffects } from './store/affects/editor.effects';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';

// directives
import { SplitDirective } from './directives/splitter.directive';


@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    AppEntryComponent,
    LayoutComponent,
    MainHeaderComponent,
    EditorComponent,
    LoaderComponent,
    AddEditPropertyDialogComponent,
    NestedConfigViewComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConfirmationDialogComponent,
    AlertDialogComponent,
    ConflictDialogComponent,
    SplitDirective
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    MaterialComponentsModule,
    HighlightModule.forRoot({ theme: 'default' }),
    StoreModule.forRoot(reducers, { metaReducers }),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
    EffectsModule.forRoot([AuthEffects, AppEffects, BackendEffects, DashboardEffects, ConfigFileAddEditEffects])
  ],
  entryComponents: [
    AddEditPropertyDialogComponent,
    CommitDialogComponent,
    SelectAppDialogComponent,
    ConfirmationDialogComponent,
    AlertDialogComponent,
    ConflictDialogComponent
  ],
  providers: [
    UtilService,
    HttpHelperService,
    AuthGuardService,
    EntryGuardService,
    FileManagementService,
    CanDeactivateGuard,
    {provide: LocationStrategy, useClass: HashLocationStrategy}
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
