import { NgModule } from '@angular/core';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { MaterialComponentsModule } from 'material-components/material-components.module';

import { HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import * as yaml from 'highlight.js/lib/languages/yaml';

// components
import { LoaderComponent } from 'components/loader/loader.component';
import { AlertDialogComponent } from 'components/alert-dialog/alert-dialog.component';
import { ConfirmationDialogComponent } from 'components/confirmation-dialog/confirmation-dialog.component';
import { EditorComponent } from 'components/editor/editor.component';
import { AddEditPropertyDialogComponent } from 'components/add-edit-property-dialog/add-edit-property-dialog.component';
import { NestedConfigViewComponent } from 'components/nested-config-view/nested-config-view.component';

// directives
import { SplitDirective } from 'directives/splitter.directive';
import { HighlightDirective } from 'directives/highlight.directive';

export const hljsLanguages = () => [{ name: 'yaml', func: yaml }];

@NgModule({
  declarations: [
    LoaderComponent,
    AlertDialogComponent,
    ConfirmationDialogComponent,
    EditorComponent,
    NestedConfigViewComponent,
    AddEditPropertyDialogComponent,
    SplitDirective,
    HighlightDirective,
  ],
  imports: [
    BrowserModule,
    MaterialComponentsModule,
  ],
  exports: [
    LoaderComponent,
    AlertDialogComponent,
    ConfirmationDialogComponent,
    EditorComponent,
    NestedConfigViewComponent,
    AddEditPropertyDialogComponent,
    SplitDirective,
    HighlightDirective,
    BrowserModule,
    MaterialComponentsModule,
  ],
  entryComponents: [
    ConfirmationDialogComponent,
    AlertDialogComponent,
  ],
  providers: [
    { provide: HIGHLIGHT_OPTIONS, useValue: { languages: hljsLanguages } },
    { provide: LocationStrategy, useClass: HashLocationStrategy }
  ]
})
export class CommonModule { }
